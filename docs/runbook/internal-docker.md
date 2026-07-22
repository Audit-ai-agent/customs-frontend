# Internal Docker Runbook

## 사전 조건

- Backend가 Docker DNS `backend:8080`에서 준비 상태여야 한다.
- `/api/v1/auth/config`의 issuer·authorization/token/end-session endpoint가 모두 Workbench origin의 `/oidc/`를 사용해야 한다.
- Keycloak client의 redirect URI에 `https://<workbench-host>/auth/callback`이 등록되어야 한다.
- Keycloak은 `KC_HTTP_RELATIVE_PATH=/oidc`를 사용하고 reverse proxy header를 신뢰하며 public issuer를 `https://<workbench-host>/oidc/realms/<realm>`로 발행해야 한다.
- Backend CORS는 same-origin reverse proxy 운용에서는 불필요하다.

## Build와 기동

```powershell
npm ci
npm run verify
docker build --pull -t customs-frontend:<git-sha> .
```

Frontend container에는 runtime secret을 주입하지 않는다. Nginx는 Docker DNS `backend:8080`과 `keycloak:8080`만 사용하며, client secret, Agent key, Evidence token, DB DSN은 Frontend image·environment·Browser에 들어가지 않는다. `/auth/callback`은 SPA route이고 `/oidc/`만 Keycloak proxy다.

## Smoke 확인

1. `/healthz`가 200인지 확인한다.
2. 응답 CSP의 `connect-src`와 `form-action`이 `'self'`만 허용하는지 확인한다.
3. 로그인 후 Browser storage에서 `localStorage`가 비어 있는지 확인한다.
4. DevTools Network에서 제품 데이터 요청이 `/api/v1` 외부로 나가지 않는지 확인한다.
5. `.pdf`·이미지 file input이 없고 text-only 경고가 보이는지 확인한다.
6. `reviewer`로 Supporting Document·typed Revision Proposal을 등록하고 직접 child Run을 만들 수 없는지 확인한다. 다섯 action(`confirm_field`, `correct_field`, `add_supporting_document`, `approve_review`, `reject_review`)을 각각 확인한다.
7. Supporting metadata 작성자와 **다른** `approver`로 human assertion을 추가하고, signed receipt 여부가 Backend Release 설정과 일치하는지 확인한다. Revision Proposal도 제안자와 다른 approver가 승인해야 child Job이 생성되는지 확인한다. `admin`도 자기 작업을 승인할 수 없다.
8. `auditor`로 조회·근거 이동·audit는 되지만 Case·문서·제안·결정 수정이 비활성인지 확인한다.
   - Backend가 Chat history GET을 403으로 제한해도 Run·Evidence·audit가 계속 표시되고 Chat은 읽기 전용 안내로 대체되어야 한다.
9. `clean_text_production_candidate_blocked`는 실행되더라도 Release/kill-switch 요건 전에 `auto_review_complete`를 성공으로 표시하지 않는지 확인한다.
10. Review enqueue 응답을 의도적으로 끊어 새로고침한 뒤 다시 로그인한다. 해당 Case의 새 Review가 차단되고, `sessionStorage`에는 조직·OIDC subject namespace 아래 `case_id`, `case_revision`, `job_id`, `job_kind`, `parent_run_id`, `review_as_of`, `request_sha256`, `idempotency_key`만 있어야 한다. Review는 `job_kind=review`, `parent_run_id=null`, Backend metadata의 정확한 `supported_review_as_of`, 그 날짜를 포함한 고정 text-only request SHA-256이어야 하며 token·원문·결과는 없어야 한다.
11. 저장된 Job 재조회 또는 명시적 "같은 요청 키로 대조"가 동일 intent를 복구하고, network/503 polling 오류가 1·2·4초 순서의 bounded backoff를 사용하는지 확인한다.
12. `reviewer`·`auditor`에는 전달 대조 form이 없고, `approver` 또는 `admin`에만 표시되는지 확인한다. Backend도 reviewer token의 reconciliation POST를 403으로 거절해야 한다.
13. 단순 timeout 설명이나 확인 체크 없는 입력으로 차단을 해제할 수 없어야 한다. 64자리 소문자 SHA-256, 10자 이상 사유, 명시적 미처리 확인을 제출한 뒤 Backend가 `failed + delivery_reconciled`를 반환해야만 복구 레코드가 삭제되고 새 심사가 활성화되어야 한다.
14. reconciliation POST 응답을 의도적으로 끊은 경우 차단과 request hash 복구 레코드가 남고 사유·증거 원문은 남지 않아야 한다. 같은 내용을 다시 제출할 때 POST보다 권위 Job GET이 먼저 호출되는지 확인한다. GET에서 `delivery_reconciled`가 확인되면 두 번째 POST 없이 운영 대조 종결로 표시되어야 한다. 계속 `delivery_uncertain`이면 같은 request hash만 재전송한다.
15. Job GET/POST가 요청 URL과 다른 `job_id` 또는 현재 화면과 다른 `case_id`를 반환하면 응답을 적용하지 않고 계속 차단하는지 확인한다.
16. Proposal approve/reject POST 응답을 의도적으로 끊고 새로고침한다. `sessionStorage`의 decision intent에는 Proposal/Run/Case ID, Case revision, parent digest, request SHA-256, idempotency key, decision만 있고 승인/거절 사유는 없어야 한다. 재로그인 후 Backend Proposal과 HumanDecision 목록을 함께 권위 원장으로 사용하고, 현재 subject·요청한 terminal status·scoped key·request digest까지 exact match인 `approved + 동일 child_job_id`에만 재연결하는지 확인한다. reject에는 child Job이 없어야 하며, 다른 actor/key/digest이면 `superseded`로 표시되고 child Job GET이 없어야 한다.
17. Case/Run/Document/Supporting/Audit/Proposal/Chat 응답이 URL ID, 로그인 조직, 선택 Case/Run lineage와 하나라도 다르면 목록 전체를 폐기하고 화면에 적용하지 않는지 확인한다.
18. SSE가 `text/event-stream`이 아니거나 요청 Job ID와 다르거나 sequence가 중복·역행하면 stream을 적용하지 않고 polling 복구 경로로 전환하는지 확인한다.
19. `human_review_required` 또는 diagnostic/production-candidate Run의 Evidence 위에 `DIAGNOSTIC EVIDENCE — NOT RELEASED`가 강하게 표시되고 각 Evidence card가 diagnostic 상태인지 확인한다. 오직 `production + auto_review_complete`만 `RELEASE-BOUND EVIDENCE`로 표시되어야 하며, 진단 Evidence를 법적 판단·자동완료 근거로 표현하면 Release를 중단한다.
20. 저장된 Run의 `result_digest`를 한 글자 바꾸거나 effective-summary의 provider hash·manifest·상태·판정·보증·완료 자격·필수 조치·stage/profile 중 하나를 변조하면 전체 Run이 거절되는지 확인한다. 자동완료의 Retrieval item을 partial/ambiguous/error 상태로 바꾸거나 report outcome reason·narrative required action을 추가해도 거절되어야 한다. 반대로 `requirements_found=true`인 요건 Evidence라도 required code가 검증된 Supporting Document profile에 결박되고 Finding이 0이면 정상 자동완료 Evidence로 표시되어야 한다.
21. 정상 Positive Control은 Review와 Chat 각각의 `model_execution_summary`가 Anthropic provider, 정확한 model ID, 양수의 call/token, text-only, 완전한 prompt/schema hash, runtime identity match, `audit_complete=true`를 모두 보여야 PASS한다. Chat은 추가로 `answered`, `generation_mode=claude`, 현재 Run FactLedger의 유효한 citation을 필수로 한다. 결정론적 fallback이거나 실행 요약이 누락된 결과를 실제 Claude 실행으로 표시하지 않는다.
22. 정상 심사 후 Chat을 아직 실행하지 않았다면 시나리오는 FAIL이 아닌 PENDING이어야 한다. Chat 실행 후 실제 Claude·근거 Gate가 성공하면 PASS, fallback·근거 오류면 FAIL로 바뀐다.
23. 시나리오 Case의 `external_reference`에 고정된 manifest SHA-256과 현재 문서·요건서류 metadata를 다시 계산한 hash가 exact match인지 확인한다. 문서 추가·교체·원문 hash 변경·요건 metadata 변경은 PASS가 아닌 INVALID이며, prefix만 모방한 수동 Case에는 시나리오 assertion을 표시하지 않는다.

## 장애와 Rollback

- OIDC callback 실패: Backend auth config의 public `/oidc/` issuer, `KC_HTTP_RELATIVE_PATH`, Keycloak hostname, redirect URI, proxy header를 비교한다.
- 401: 새로고침으로 memory token이 사라졌는지 확인하고 다시 로그인한다.
- 409: Case/Run을 새로 불러온 뒤 correction을 다시 작성한다.
- 422: Evidence·판정·Release identity처럼 수정 금지 경로를 요청했는지 확인한다.
- `delivery_uncertain` 또는 enqueue 응답 유실: 해당 Case의 새 Review를 만들지 않는다. 저장된 Job을 먼저 재조회하고, Job ID조차 받지 못했다면 UI의 명시적 복구 동작으로 **같은 Idempotency-Key**만 재전송한다. 새 key를 발급해 재실행하지 않는다. Backend audit/outbox와 Agent replay ledger를 대조해 성공/실패가 확정된 뒤 차단이 해제된다.
- `delivery_reconciled`: Agent가 실제 처리했는지 불명확한 상태를 임의 성공으로 바꾸는 기능이 아니다. Approver/Admin이 Agent 미수신을 입증하는 불변 운영 증거를 제출하고 Backend가 기존 Job을 실패로 종결하는 상태 전이이다. 처리되었거나 처리 가능성이 남아 있으면 사용하지 않는다.
- reconciliation 응답 유실: 새 reconciliation이나 Review를 추측 실행하지 말고 같은 Job을 GET한다. `failed + delivery_reconciled`가 확인되면 종결하고, 계속 `delivery_uncertain`이면 감사/outbox/Agent 수신 원장을 다시 대조한다.
- 반복 polling 오류: 408/425/429/500/502/503/504와 network 오류는 최대 8회 bounded backoff한다. 한도 소진을 성공이나 실패로 추정하지 말고 복구 레코드를 유지한 채 Backend 상태를 확인한다.
- 계약 drift: Backend exact OpenAPI로 `npm run contract:generate -- <file>`를 실행해 snapshot·generated type·lock을 의도적으로 갱신하고 diff를 검토한다. 단순 hash 우회는 금지한다.
- Release rollback은 이전 immutable image tag로 되돌리고 cache를 무효화한다.
