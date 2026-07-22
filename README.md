# Customs Frontend Workbench

내부 통관 심사 담당자가 text-only AI 사전심사를 실행하고 근거·수정·승인 이력을 검토하는 최소 제품 작업대다. Vite와 strict TypeScript로 빌드되며 Browser의 제품 데이터 호출은 Backend `/api/v1`로 제한한다.

## 제공 기능

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

이 Workbench는 Backend의 `GET /api/v1/uat/metadata`만 통해 안전한 실행 상태를 읽고 화면 상단에 고정 표시한다. Browser가 Agent, Data 또는 해당 서비스의 readiness endpoint를 직접 호출하지 않는다. 표시 항목은 실제 Claude 모드, Evidence profile과 범위(`3/58` 포함), Planner 모드, text-only 여부, assurance ceiling, 자동완료 상태다. 메타데이터를 읽지 못하면 Release를 추정하지 않고 `UNKNOWN / AUTO-COMPLETION OFF / NOT PRODUCTION`으로 닫힌다.

시나리오 결과는 서로 다른 두 판정으로 표시한다.

- `시나리오 기능 PASS/FAIL`: 검증된 LOCAL UAT runtime identity·실제 Claude·설정된 Evidence/Planner, 실행·assessment와 시나리오가 선언한 Issue/Finding/Evidence/성공 Action/XAI citation 조건
- `업무 처리 결과`: `human_review_required` 등 실제 disposition과 Release 차단 사유

따라서 합성 정상 시나리오가 기능 PASS여도 Production 승인이나 자동완료로 표현하지 않는다. runtime metadata가 없거나 UNKNOWN이면 결과값이 맞아 보여도 기능 FAIL이다. `clean_text_no_requirement_uat`은 synthetic-v3의 HSK `7318151000` 무요건 정책을 위한 완전 정합 Positive Control이다. 이 경우 `coverage=complete`, `requirements_found=false`, 조회 대상 품목 1개 이상, Evidence 0건이 정상이며 성공한 `evidence.retrieve/v3` Action trace로 실제 조회 수행을 별도 검증한다. `clean_text_untrusted_supporting_document`는 합성 발급자를 신뢰기관으로 승격하지 않는 별도 fail-closed Control이며 해당 차단 reason code도 기능 조건으로 확인한다. child Run에서는 직접 parent Run과 상태·필드·Issue·Finding·Evidence·필수 조치의 before/after를 결정론적으로 비교한다.

V3 text 입력은 일반 문서 최대 6개, 문서당 200,000자/800,000 UTF-8 bytes, 일반 문서 합계 500,000자로 제한한다. 문서 목록은 원문을 합쳐 반환하지 않고 hash·문자·byte metadata만 주며, 일반 문서만 개별 content endpoint로 제한된 범위에서 불러와 목록 metadata와 SHA-256을 재검증한다. `SUPPORTING` 원문은 별도 metadata/hash로 결박하며 Agent 분류 대상에 포함하지 않는다. 요건서류 metadata는 Case당 최대 100개다.

현재 Release는 PDF·이미지·OCR 파일 입력을 제공하지 않는다. 이 Task의 화면은 `LOCAL UAT / DIAGNOSTIC`이며 도메인 2인 승인과 Agent/Data Release Gate 전에는 Production 완성으로 표현하지 않는다.

## 로컬 실행

요구사항: exact Node.js `22.23.1`, exact npm `10.9.8`, `/api/v1`을 제공하는 Backend. `.npmrc`의 `engine-strict=true`와 `npm run doctor`가 다른 runtime을 fail-closed한다.

```powershell
npm ci
$env:BACKEND_ORIGIN='http://127.0.0.1:8080'
$env:OIDC_BACKEND_ORIGIN='http://127.0.0.1:8082'
npm run dev
```

Backend의 `/api/v1/auth/config`가 OIDC issuer/client/endpoint를 제공해야 한다. Browser에 표시되는 OIDC URL은 Workbench의 same-origin `/oidc/`를 사용하고, Vite/Nginx가 내부 Keycloak로 proxy한다. SPA callback `/auth/callback`과 proxy 경로를 분리해 callback이 Keycloak으로 오라우팅되지 않게 한다. access token은 메모리에만 저장된다. OAuth state·PKCE verifier와 미확정 Review/Proposal decision intent의 식별자·버전·digest·request hash·idempotency key만 `sessionStorage`에 둔다. 모든 복구 레코드는 `org_id`와 OIDC `subject`로 namespace를 분리하고 종류별 최대 50개로 제한한다. Proposal 승인/거절 사유, 문서 원문·결과·token은 저장하지 않으며, 새로고침 뒤 로그인하면 Backend의 Job/Proposal 원장을 재조회해 응답 유실을 대조한다.

Review 복구 레코드는 `kind=review`, `parent_run_id=null`, Case revision, 현재 OIDC subject, 고정 text-only 요청의 canonical SHA-256과 정확히 일치해야 한다. Proposal decision의 직접 응답과 복구는 Backend decision 원장의 동일 Proposal/Run/Case/org, 현재 actor, 요청한 terminal status, scoped idempotency key, request digest가 모두 일치할 때만 child revision Job을 결박한다. approve에는 동일 ID의 child Job이 필수이고 reject에는 child Job이 없어야 한다. 다른 actor·key·digest가 먼저 종결한 intent는 `superseded`로 표시하며 그 child Job을 현재 raw key에 연결하지 않는다.

요건서류가 있는 합성 UAT Case 생성은 원문과 metadata까지만 만든다. `requires_approver` 시나리오는 같은 사용자가 즉시 스스로 검증하지 않으며 다른 `approver` 계정이 assertion을 추가해야 한다. 반대로 미신뢰 발급자 Control은 assertion 추가 전에 실행해 차단을 확인한다. Backend signer가 release-bound trust root와 일치할 때만 signed receipt가 생성되며, unsigned 진단 기록은 자동완료 근거가 아니다. 이 두 사람 절차를 거치더라도 미승인 Agent/Data Release에서는 `auto_review_complete`가 활성화되지 않는다.

`delivery_uncertain`은 실패로 추정하거나 단순 timeout만으로 해제하지 않는다. 저장된 Job을 먼저 재조회하고, 여전히 불확실하면 Backend가 승인한 `approver` 또는 `admin`만 Agent 미수신을 입증하는 독립 운영 증거의 SHA-256·사유·명시적 확인을 제출할 수 있다. 대조 POST 직전에 민감 내용을 제외한 request hash를 `sessionStorage`에 저장한다. 응답을 잃으면 다음 POST 전에 반드시 권위 Job GET을 수행하고, 여전히 `delivery_uncertain`이며 요청 hash가 같을 때만 재전송한다. Backend가 `failed + delivery_reconciled`를 반환해야 브라우저가 복구 레코드를 지우고 새 심사를 허용한다.

## 검증

```powershell
npm run verify

# Backend exact SHA에서 export한 OpenAPI로 snapshot·TypeScript type·lock 재생성
$env:BACKEND_OPENAPI_FILE='C:\path\to\openapi.json'
npm run contract:generate

# 저장소에 고정된 exact OpenAPI/type hash 검증
$env:BACKEND_OPENAPI_FILE='C:\path\to\openapi.json'
npm run contract:check
```

`verify`는 exact runtime doctor, 경계/XSS 정적 검사, 계약 검사, strict typecheck, DOM·접근성 전체 테스트와 coverage gate, production build를 실행한다. 경계 검사는 외부 GitHub Action의 40자리 commit pin과 Docker/Gitleaks/Trivy의 SHA-256 digest pin도 강제한다. GitHub Actions는 여기에 high 이상 dependency audit, dependency·container CycloneDX SBOM과 30일 보존, 고정 digest Gitleaks의 현재 소스·전체 Git history fail-closed 검사, 미수정 취약점을 예외 처리하지 않는 Trivy High/Critical runtime 스캔, read-only/non-root container smoke를 추가한다. Windows linked worktree에서는 `scripts/run-gitleaks.ps1`을 사용한다.

`tests/fixtures/backend-63079af-public-review-run.json`은 Backend commit `63079affe205…`의 실제 public serializer 전체 응답이다. Frontend는 이 안전 공개 형식만 소비하며 provider 전용 `schema_version`, `status`, `requires_human_review`, `case_id`, `input_manifest_sha256`를 `result_detail`에 요구하거나 다시 주입하지 않는다. Backend와 동일한 effective-summary canonical JSON SHA-256을 다시 계산해 `result_digest`를 검증하고, 자동완료에서는 Retrieval item의 exact HS resolution·complete coverage·빈 errors·item-bound Evidence 및 보고서의 빈 outcome/action 이유까지 일관되어야 한다. 발견된 법령 요건이 있어도 검증된 Supporting Document code와 profile에 결박되어 Finding 없이 충족된 경우는 정상 자동완료를 허용한다.

## Production container

```powershell
docker build -t customs-frontend:task-0020 .
docker run --rm -p 8081:8080 customs-frontend:task-0020
```

Nginx는 `/api/v1/`을 `backend:8080`, `/oidc/`를 `keycloak:8080`에 proxy한다. Browser는 자체 origin 밖으로 제품 API·token 요청을 보내지 않는다. 자세한 절차는 `docs/runbook/internal-docker.md`를 따른다.
