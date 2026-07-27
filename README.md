# Customs Frontend Workbench

내부 통관 심사 담당자가 text-only AI 사전심사를 실행하고 결론·원인·법령 근거·다음 조치·수정·승인 이력을 확인하는 상용형 Local UAT 작업대다. React 19, Vite와 strict TypeScript로 빌드되며 Browser의 제품 데이터 호출은 Backend `/api/v1`과 `/api/v2`로만 제한한다.

## 제공 기능

- 한국어 중심의 로그인·심사 업무함·Case 업무 화면과 반응형 App Shell
- 결론→과정→문서 대조→원인→법령 의미→영향→조치→한계의 8구역 장문 AI 보고서
- Backend가 영속한 실제 심사 단계·경과시간·실측 또는 검증 기본 ETA 표시
- Case 결과 SHA에 결박된 멀티턴 AI 심사 도우미와 직접 답변·이유·근거·영향·조치 구역
- 법령·문서·확인 사항으로 이동하고 focus되는 근거 링크
- 기본 화면의 내부 코드 제거와 model/profile/hash를 분리한 검증 정보 Drawer
- `/test-lab`의 실제 3법령 RAG 합성 시나리오 9개
- OIDC Authorization Code + PKCE 로그인 진입점
- Case 목록·생성, text-only 문서 등록
- 인증된 SSE 실행 단계와 Job polling fallback
- 원문·추출/불일치·법령 Evidence 3-pane 심사
- 미승인 Run의 법령 결과에 `DIAGNOSTIC EVIDENCE — NOT RELEASED` 경계와 별도 시각 스타일 적용
- `execution / assessment / disposition / assurance` 분리 표시
- source ledger에 결박된 XAI 보고서와 Case Chat
- 원문 hash에 결박된 요건서류, 작성자·검증자 분리(maker-checker), signed/unsigned verification receipt 구분
- parent digest·input manifest·Case revision에 결박된 typed Revision Proposal→독립 Approver 승인→child rerun
- `confirm_field`, `correct_field`, `add_supporting_document`, `approve_review`, `reject_review` 전체 revision action
- required action, Run lineage, immutable audit 보기
- Agent 전달 불확실 상태의 Case별 재실행 차단, 새로고침 복구, 동일 Idempotency-Key 수동 대조
- Review와 Proposal decision intent의 조직·사용자별 bounded 복구, 응답 유실 시 Backend Proposal·child Job 원장 재조회
- Approver/Admin이 Agent 미처리를 입증하는 운영 증거 SHA-256을 제출하는 명시적 `delivery_reconciled` 종결
- 정상/결함/보안 합성 UAT 시나리오 선택기

## LOCAL USER UAT 경계

상용형 Workbench는 Backend의 `GET /api/v2/uat/metadata`를 통해 안전한 실행 상태와 Experience/Assistant/실제 단계 기능을 읽습니다. 기존 작업대의 `/api/v1/uat/metadata` 계약은 그대로 보존합니다. Browser가 Agent, Data 또는 해당 서비스의 readiness endpoint를 직접 호출하지 않습니다. 표시 항목은 실제 Claude 모드, Evidence profile과 범위(`3/58` 포함), Data source, 관측 법령·조문 수, PostgreSQL/Qdrant/Neo4j 개수, `rag_quality_evaluated=false`, Planner 모드, text-only 여부, assurance ceiling, 자동완료 상태, Backend가 지원하는 `supported_review_as_of`입니다. 메타데이터나 이 기준일을 읽지 못하면 새 심사를 실행하지 않고 안전하게 닫힙니다. 모든 Review 요청은 화면에 표시된 이 날짜를 정확히 전달하며 현재 날짜를 임의로 대입하지 않습니다.

시나리오 결과는 기능 Gate와 업무 처리 판정을 분리해 표시한다.

- `시나리오 기능 PASS/FAIL/PENDING/INVALID`: 검증된 LOCAL UAT runtime identity·고정 기준일·설정된 Evidence/Planner, 실행·assessment와 시나리오가 선언한 Issue/Finding/Evidence/필수 심사 단계/XAI citation 조건. 실제 Claude는 Backend가 제공한 비민감 `model_execution_summary`의 provider·model·호출 수·token·prompt/schema hash·runtime identity·audit이 모두 완전할 때만 PASS. Chat을 아직 실행하지 않은 정상 상태는 FAIL이 아닌 PENDING, 시나리오 입력이 Gold와 달라진 상태는 INVALID
- `업무 처리 결과`: `human_review_required` 등 실제 disposition과 Release 차단 사유

따라서 UAT 정상 시나리오가 기능 PASS여도 Production 승인이나 자동완료로 표현하지 않는다. 각 시나리오는 정렬된 문서 type·filename·media type·원문 SHA-256과 요건서류 metadata의 canonical manifest hash를 Case `external_reference`에 결박한다. 현재 Case manifest를 다시 계산해 exact match가 아니면 INVALID이며, 단순히 시나리오 prefix만 모방한 Case는 Gold assertion에 연결하지 않는다. runtime metadata가 없거나 UNKNOWN이면 결과값이 맞아 보여도 기능 FAIL이다.

`clean_text_no_requirement_uat`은 HSK `7318151000` 완전 정합 Positive Control이다. Synthetic 프로필에서는 Evidence 0건인 명시적 계약 fixture를, Actual 3-Law 프로필에서는 인용 가능한 실제 법령 Evidence와 `coverage=complete`, `requirements_found=false`, dense/BM25/graph provenance를 기대한다. `actual_3law_structured_requirement_human_only`은 HSK `0303540000`의 실제 CCCT structured 요건을 찾되 승인되지 않은 requirement policy 때문에 `partial/human_only`와 사람 검토로 닫히는 것을 확인한다. 프로필별 기대값은 현재 process-level metadata에 따라 선택되며, 호환되지 않는 시나리오는 UI에서 비활성화된다. Gap이 없는 정상 흐름에서 선택적 adaptive Tool trace를 억지로 요구하지 않는다. Positive Control은 추가로 Case Chat이 `answered`, `generation_mode=claude`, 유효한 Case citation을 가지고 Chat 실행 요약이 완전해야 PASS한다. Chat 실행 전에는 Core 심사가 정상이더라도 PENDING으로 안내한다. child Run에서는 직접 parent Run과 상태·필드·Issue·Finding·Evidence·필수 조치의 before/after를 결정론적으로 비교한다.

실제 RAG Run은 Backend가 검증한 bounded provenance만 표시한다. 화면에는 query/HSK, structured 해소 상태, 검색 순위, `exact_hs`·`dense`·`bm25`·`graph`, final/raw score, 법령·조문·version hash·공식 URI가 나타난다. 이 provenance가 없으면 Actual 프로필 라벨만으로 검색이 실행됐다고 간주하지 않고 경고한다.

V3 text 입력은 일반 문서 최대 6개, 문서당 200,000자/800,000 UTF-8 bytes, 일반 문서 합계 500,000자로 제한한다. 문서 목록은 원문을 합쳐 반환하지 않고 hash·문자·byte metadata만 주며, 일반 문서만 개별 content endpoint로 제한된 범위에서 불러와 목록 metadata와 SHA-256을 재검증한다. `SUPPORTING` 원문은 별도 metadata/hash로 결박하며 Agent 분류 대상에 포함하지 않는다. 요건서류 metadata는 Case당 최대 100개다.

현재 Release는 PDF·이미지·OCR 파일 입력을 제공하지 않는다. 이 Task의 화면은 `LOCAL UAT / DIAGNOSTIC`이며 도메인 2인 승인과 Agent/Data Release Gate 전에는 Production 완성으로 표현하지 않는다.

## 로컬 실행

요구사항: exact Node.js `22.23.1`, exact npm `10.9.8`, `/api/v1`을 제공하는 Backend. `.npmrc`의 `engine-strict=true`와 `npm run doctor`가 다른 runtime을 fail-closed한다.

```powershell
npm ci
$env:BACKEND_ORIGIN='http://127.0.0.1:8080'
$env:OIDC_BACKEND_ORIGIN='http://127.0.0.1:8082'
$env:CUSTOMS_ENHANCED_AGENT_EXPERIENCE='true'
$env:CUSTOMS_UAT_ADAPTIVE_ACTIVE='true'
npm run dev
```

Backend의 `/api/v1/auth/config`가 OIDC issuer/client/endpoint를 제공해야 한다. Browser에 표시되는 OIDC URL은 Workbench의 same-origin `/oidc/`를 사용하고, Vite/Nginx가 내부 Keycloak로 proxy한다. SPA callback `/auth/callback`과 proxy 경로를 분리해 callback이 Keycloak으로 오라우팅되지 않게 한다. access/id/refresh token은 메모리에만 저장한다. 보호 API 요청 직전에 만료가 가까우면 refresh token을 single-flight로 갱신하며 subject가 바뀌거나 갱신이 실패하면 세션을 폐기한다. OAuth state·PKCE verifier와 미확정 Review/Proposal decision intent의 식별자·버전·digest·request hash·idempotency key만 `sessionStorage`에 둔다. 모든 복구 레코드는 `org_id`와 OIDC `subject`로 namespace를 분리하고 종류별 최대 50개로 제한한다. Proposal 승인/거절 사유, 문서 원문·결과·token은 저장하지 않으며, 새로고침 뒤 로그인하면 Backend의 Job/Proposal 원장을 재조회해 응답 유실을 대조한다.

Enhanced Review와 AI 심사 도우미도 외부 호출 전에 비민감 재시도 intent를 먼저 기록한다. Review는 Case ID·심사 기준일·idempotency key만 저장하고 문서 내용은 저장하지 않는다. 질문은 `conversation_id + bound result hash + parent message ID + 질문`의 SHA-256으로 만든 idempotency key만 저장하며 질문·답변 원문은 저장하지 않는다. Assistant POST 응답을 잃은 경우 Backend 대화 원장에 이미 영속된 마지막 사용자 메시지가 해당 key와 정확히 일치할 때만 같은 key로 재전송한다. Job이 확인된 뒤에는 권위 Job 상태가 terminal임을 확인하기 전까지 intent를 지우지 않는다.

Review 복구 레코드는 `kind=review`, `parent_run_id=null`, Case revision, 현재 OIDC subject, 당시 Backend가 발행한 `review_as_of`, 고정 text-only 요청의 canonical SHA-256과 정확히 일치해야 한다. 현재 메타데이터 기준일과 다른 복구 intent는 재전송하지 않는다. Proposal decision의 직접 응답과 복구는 Backend decision 원장의 동일 Proposal/Run/Case/org, 현재 actor, 요청한 terminal status, scoped idempotency key, request digest가 모두 일치할 때만 child revision Job을 결박한다. approve에는 동일 ID의 child Job이 필수이고 reject에는 child Job이 없어야 한다. 다른 actor·key·digest가 먼저 종결한 intent는 `superseded`로 표시하며 그 child Job을 현재 raw key에 연결하지 않는다.

요건서류가 있는 합성 UAT Case 생성은 원문과 metadata까지만 만든다. `requires_approver` 시나리오는 같은 사용자가 즉시 스스로 검증하지 않으며 다른 `approver` 계정이 assertion을 추가해야 한다. 반대로 미신뢰 발급자 Control은 assertion 추가 전에 실행해 차단을 확인한다. Backend signer가 release-bound trust root와 일치할 때만 signed receipt가 생성되며, unsigned 진단 기록은 자동완료 근거가 아니다. 이 두 사람 절차를 거치더라도 미승인 Agent/Data Release에서는 `auto_review_complete`가 활성화되지 않는다.

`delivery_uncertain`은 실패로 추정하거나 단순 timeout만으로 해제하지 않는다. 저장된 Job을 먼저 재조회하고, 여전히 불확실하면 Backend가 승인한 `approver` 또는 `admin`만 Agent 미수신을 입증하는 독립 운영 증거의 SHA-256·사유·명시적 확인을 제출할 수 있다. 대조 POST 직전에 민감 내용을 제외한 request hash를 `sessionStorage`에 저장한다. 응답을 잃으면 다음 POST 전에 반드시 권위 Job GET을 수행하고, 여전히 `delivery_uncertain`이며 요청 hash가 같을 때만 재전송한다. Backend가 `failed + delivery_reconciled`를 반환해야 브라우저가 복구 레코드를 지우고 새 심사를 허용한다.

각 Review 또는 child Revision Job은 브라우저에서 최대 12분 동안 wall-clock 기준으로 추적한다. 이 시간은 실제 Claude 실행과 Backend 10분 Job lease보다 길게 잡은 UI 관찰 한도이며, 초과를 Agent 실패로 해석하거나 recovery/idempotency 결박을 삭제하지 않는다. 사용자가 저장된 동일 Job을 명시적으로 재조회해야 한다.

## 검증

```powershell
npm run verify

# Backend exact SHA에서 export한 OpenAPI로 snapshot·TypeScript type·lock 재생성
$env:BACKEND_OPENAPI_FILE='C:\path\to\openapi.json'
npm run contract:generate

# 저장소에 고정된 exact OpenAPI/type hash 검증
$env:BACKEND_OPENAPI_FILE='C:\path\to\openapi.json'
npm run contract:check

# 실행 중인 loopback 전체 UAT에서만 실제 Browser Gate 실행
$env:CUSTOMS_E2E_LIVE='true'
$env:CUSTOMS_UAT_BASE_URL='http://127.0.0.1:18088'
$env:CUSTOMS_E2E_CREDENTIALS_FILE='C:\absolute\path\outside-repository\credentials.json'
$env:CUSTOMS_E2E_SCENARIO_BINDINGS_FILE='C:\absolute\artifact\browser-scenario-bindings.json'
$env:CUSTOMS_E2E_SCENARIO_BINDINGS_SHA256='<Harness가 계산한 파일 SHA-256>'
# 특정 시나리오 Case를 exact 결박할 때만 선택적으로 지정
$env:CUSTOMS_E2E_CASE_EXTERNAL_REFERENCE='UAT2:<scenario>:EVAL:<manifest-sha256>'
npm run test:e2e
```

`verify`는 exact runtime doctor, 경계/XSS 정적 검사, 계약 검사, strict typecheck, DOM·접근성 전체 테스트와 coverage gate, production build, commercial/legacy bundle 격리 검사를 실행합니다. Browser E2E는 실제 Backend·Agent·Data가 실행 중인 literal loopback UAT에서 별도 실행하며, 명시적인 `CUSTOMS_E2E_LIVE=true`가 없으면 시작 자체를 거절합니다. 또한 현재 Harness 실행이 만든 9개 Case·Review Run·결과 SHA 결박 파일의 절대경로와 파일 SHA-256을 필수로 받아, 과거 UAT 결과를 현재 결과로 오인하지 않습니다. Reviewer 계정은 저장소 밖 credential JSON(`users.reviewer.username/password`) 또는 `CUSTOMS_E2E_REVIEWER_USERNAME`·`CUSTOMS_E2E_REVIEWER_PASSWORD` 쌍으로만 전달합니다. OAuth token이 메모리 전용이므로 각 시험에서 실제 Keycloak 로그인을 수행하며, 로그인 조작에 credential이 남지 않도록 Playwright 자동 trace·video·screenshot은 수집하지 않습니다. 성공 증거용 명시적 화면 캡처만 수행하며 질문·답변·보고서 본문·입력란·기술 정보는 자동 마스킹합니다. Chrome 1440×900에서는 전체 업무 흐름, Edge 1024×768과 Chrome 390×844에서는 동일 반응형·접근성 Gate만 수집하므로 expected skip은 0입니다. 키보드, 200% 확대, reduced-motion, CSP 위반도 함께 검사합니다. 경계 검사는 외부 GitHub Action의 40자리 commit pin과 Docker/Gitleaks/Trivy의 SHA-256 digest pin도 강제합니다. GitHub Actions는 여기에 high 이상 dependency audit, dependency·container CycloneDX SBOM과 30일 보존, 고정 digest Gitleaks의 현재 소스·전체 Git history fail-closed 검사, 미수정 취약점을 예외 처리하지 않는 Trivy High/Critical runtime 스캔, read-only/non-root container smoke를 추가합니다. Windows linked worktree에서는 `scripts/run-gitleaks.ps1`을 사용합니다.

`tests/fixtures/backend-task0027-public-review-run.json`은 실제 Backend serializer에서 시작해 현재 안전 공개 projection과 result-digest-bound 실제 Store 실행 증명을 고정한 회귀 fixture다. Frontend는 이 형식만 소비하며 provider 전용 raw 필드나 legacy V2 보고서를 다시 주입하지 않는다. Backend와 동일한 effective-summary canonical JSON SHA-256을 다시 계산해 `result_digest`를 검증하며, 추출·설명·검색 실행 여부는 원문과 credential이 제거된 공개 audit projection만 strict decode한다. 자동완료에서는 Retrieval item의 exact HSK resolution·complete coverage·빈 오류·item-bound 법령 근거와 실행 identity까지 일관되어야 한다. Gate가 충족되지 않은 설명은 검증된 결정론적 fallback으로 명확히 구분하며, 사용자 화면의 결과를 임의로 상향하지 않는다.

## Production container

```powershell
docker build -t customs-frontend:task-0020 .
docker run --rm -p 8081:8080 customs-frontend:task-0020
```

Nginx는 `/api/v1/`과 `/api/v2/`를 `backend:8080`, `/oidc/`를 `keycloak:8080`에 proxy합니다. Browser는 자체 origin 밖으로 제품 API·token 요청을 보내지 않습니다. 자세한 절차는 `docs/runbook/internal-docker.md`를 따릅니다.
