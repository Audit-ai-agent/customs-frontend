# Frontend Architecture Boundary

```text
Browser
├─ same-origin /oidc + PKCE ─────> Keycloak proxy
└─ HTTPS /api/v1 only ──────────────> FastAPI Backend
                                      ├─ Case / Document / Job
                                      ├─ Review / HITL / Chat / Audit
                                      └─ private Agent + Data orchestration
```

## 경계

- Browser는 Agent internal API, Evidence API, PostgreSQL, Qdrant, Neo4j를 직접 호출하지 않는다.
- Backend API token 외에 Agent/Data credential을 보유하지 않는다.
- `oidc-client-ts`의 access token store는 memory-only다. callback을 위한 state/PKCE verifier만 `sessionStorage`에 일시 보관한다.
- Backend가 canonical Case, Job, Run, revision, decision과 audit 상태를 소유한다.
- Frontend의 로컬 상태는 표시·미입력 form·polling 상태뿐이며 심사 결과의 원장이 아니다. 새로고침 복구에는 Review와 Proposal decision intent의 Case/Run/Proposal/Job 식별자, revision, digest, request hash, idempotency key만 sessionStorage에 보존하고 token·문서·결과·승인 사유를 보존하지 않는다. 레코드는 `org_id`와 OIDC `subject`로 namespace를 분리하고 종류별 50개를 초과하면 fail-closed한다.

## 안전한 표현

- Backend 및 Claude 문자열은 `textContent` 기반 DOM API로만 렌더링한다.
- Narrative claim은 citation ID를 가지며 ID가 현재 Run에서 해석될 때만 근거로 이동한다.
- 한 상태로 축약하지 않고 실행 성공, 업무 평가, 처리 disposition, 보증 수준을 분리한다.
- Reviewer의 확인·correction·요건서류 추가·승인/거절은 typed revision proposal로만 저장된다. Approver가 parent result digest·input manifest·Case revision을 재검증해 승인해야 Backend이 child Run Job을 생성한다.
- Supporting document 등록자와 verification assertion 승인자는 달라야 하며 `admin`에도 자기 승인 예외를 두지 않는다.
- Verification assertion은 Backend가 생성한 불변 decision lineage와 Agent trust-domain receipt를 구분해 표시한다. Browser는 receipt의 암호학적 검증 주체가 아니며 Backend 검증 결과를 표시한다. Receipt가 없는 사람 확인은 진단 기록이지 자동완료 신뢰 근거가 아니다.
- `delivery_uncertain` 또는 응답 유실 intent가 있는 Case는 새 Review를 차단한다. Frontend가 새 key로 자동 재호출하지 않고, 저장된 Job 재조회나 사용자가 명시한 동일 key 재전송만 허용해 Backend 원장과 대조한다.
- 전달 차단의 인적 해제는 Backend의 Approver 권한(`approver`/`admin`)이 강제되는 reconciliation API만 사용한다. UI도 현재 Case·Job·복구 레코드가 모두 일치하고, 미수신 운영 증거 SHA-256·사유·명시적 확인이 있을 때만 요청한다.
- reconciliation 요청 직전에 Case·Job·request SHA-256·시각만 session-scoped 복구 레코드로 저장하며 사유나 증거 원문은 저장하지 않는다. 응답 유실 후 재시도는 응답을 먼저 권위 Job GET으로 대조하고, 같은 request hash와 계속된 `delivery_uncertain`이 확인될 때만 POST한다. 응답은 요청한 Job ID, 현재 Case ID, `status=failed`, `agent_call_state=delivery_reconciled`가 모두 일치해야 적용한다.
- Proposal decision은 POST 전에 intent를 보존하고, 응답 유실 시 승인된 Proposal의 `child_job_id`를 포함한 Backend 목록을 권위 있는 상태로 재조회한다. 직접 응답과 재조회 모두 현재 actor, 요청한 approve/reject와 terminal status, `proposal.child_job_id == revision Job ID`를 정확히 만족해야 하며 reject에는 child Job이 없어야 한다. 로컬 intent만으로 승인·거절 결과를 추정하지 않는다.
- 응답 유실 복구에서 Proposal/Run/Case/org·현재 OIDC actor·scoped idempotency key·canonical request digest가 정확히 같은 HumanDecision 한 건만 현재 intent로 인정한다. 다른 actor/key/digest의 terminal decision은 `superseded`이며 해당 child Job을 현재 intent에 결박하지 않는다.
- Review Job은 `kind=review`, `parent_run_id=null`, 현재 subject가 생성자이고 session-scoped 복구 레코드의 Case·revision·canonical request SHA-256과 맞을 때만 재연결한다. Revision/다른 actor/변조된 digest Job은 계속 차단한다.
- Proposal 생성·결정과 Case Chat의 응답은 Backend가 반환한 scoped idempotency key와 request digest를 신뢰하지 않고, Frontend가 endpoint·OIDC subject·organization·Case·사용자 키·요청 본문에서 SHA-256을 재계산해 exact match일 때만 적용한다.
- Job 조회의 일시적 408/425/429/5xx·network 오류는 최대 8회, 15초 상한의 지수 backoff로 재시도한다. 한도 소진 뒤에도 차단 상태와 복구 식별자는 유지한다.
- Narrative·Chat·required action의 ID가 현재 Run source ledger에 없으면 응답 전체를 표시하지 않는다.
- Issue와 Finding은 배열 순서로 Ledger에 연결하지 않는다. 명시적 reference ID 또는 유일한 의미 일치가 없으면 응답을 계약 오류로 거절한다.
- Auditor는 Chat 쓰기 권한이 없으며 Backend가 Chat history GET도 403으로 제한하면 Run 전체를 버리지 않고 읽기 전용 안내와 나머지 Evidence·audit를 표시한다.
- 숨은 chain-of-thought를 표시하지 않는다. 안정된 stage, tool, reason code와 observation만 표시한다.
- `production + auto_review_complete`에 결박되지 않은 Evidence는 법령 검색 진단 결과로 분리하고 강한 `DIAGNOSTIC EVIDENCE — NOT RELEASED` 경고를 표시한다. 진단 Evidence를 법적 판단·Production 자동완료 근거처럼 표현하지 않는다.

## 계약

`contracts/backend-openapi-v1.json`은 Backend exact commit이 LF로 canonical export한 public OpenAPI 전체 snapshot이다. `src/api/v1/generated.ts`를 이 snapshot에서 생성하고, 두 파일의 SHA-256과 operation 수를 `contracts/backend-openapi-v1.lock.json`에 고정한다. CI는 exact hash drift를 차단하고 runtime decoder가 HTTP status를 권위 있는 상태로 사용하며 URL ID·세션 조직·Case/Run lineage, stable reference binding과 자동완료 Release envelope를 추가로 검증한다. 모든 Run은 Backend effective-summary 필드와 기본값을 같은 canonical JSON으로 직렬화한 SHA-256이 `result_digest`와 일치해야 하며, 이 digest에는 bounded extraction/narrative 실행 summary도 포함된다. 자동완료는 Backend의 안전 공개 `result_detail` exact allowlist, 명시적 빈 issue/finding/gap/action 배열, 문서·Retrieval item의 HS resolution·coverage·error·Evidence·FactLedger 일치, V3 `narrative_report` citation 결박, 두 모델 실행 summary의 완전한 audit, 단일 결정론적 outcome, Released Evidence·Release identity가 모두 일치해야 한다. Legacy V2 `result_detail.report`는 공개 계약이 아니므로 응답에 있으면 전체 Run을 거절한다. `requirements_found=true` 자체는 실패가 아니다. finding-eligible 요건 Evidence의 required code가 Backend의 검증된 Supporting Document에서 만든 `approved_required_document_codes`에 포함되고 Finding 0인 정상 Case를 허용하며, 누락·미결박·blocked Evidence만 거절한다. 목록 중 하나라도 aggregate를 벗어나면 전체 응답을 적용하지 않는다.

문서 목록은 `content_text=null`인 metadata aggregate로 소비하고 character/byte/hash를 먼저 검증한다. 최대 6개의 primary 문서만 개별 `/documents/{document_id}/content`로 불러온 뒤 목록의 불변 metadata와 원문 SHA-256이 정확히 일치할 때 표시한다. 이는 100개 supporting 원문이 목록 응답에 합쳐져 브라우저에 유입되는 것을 차단한다.

외부 GitHub Action은 40자리 commit SHA, Docker build/runtime 및 Gitleaks image는 SHA-256 digest로 고정한다. `npm run lint`가 pin 누락을 검사하고 실제 build·secret scan에서 digest 해석 가능성을 다시 확인한다.
