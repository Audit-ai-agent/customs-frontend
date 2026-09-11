# Customs Frontend

팀 개발과 실제 기능 UAT를 위한 사건 중심 Browser 심사 작업대입니다. 심사 업무함에서 연
Case는 문서 → 교차 검증 → 통관 심사 → 관세 네 단계와 AI 도우미·심사 이력 화면으로 이어집니다. Browser는 Backend
API v1만 호출합니다. Agent, Data, PostgreSQL, Qdrant, Neo4j 주소나 비밀값을
Browser에 전달하지 않습니다.

## 두 실행 모드

| 명령 | 용도 | 필요한 입력 |
| --- | --- | --- |
| corepack npm run dev:local | 기본 팀 개발 | 없음 |
| corepack npm run dev:functional-uat | 실제 기능 UAT 화면 | Backend Functional-UAT와 OIDC 설정 |
| Backend의 `uv run --no-sync python tools/run_functional_uat_browser_e2e.py` | 실제 Browser 대표 E2E | 준비된 네 서비스·개인 Functional-UAT profile |

기본 개발은 Backend의 loopback 전용 development session을 메모리에만
보관합니다. 공용 키, OIDC, Docker, 모델 cache, Law API 또는 Claude 키가
필요하지 않습니다. 기본은 `reviewer` 세션으로 시작합니다. 상단의 **개발 역할**에서
명시적으로 `approver` 세션으로 바꾸면 Browser는 `POST /api/v1/dev/session`에
`{"actor":"approver"}`만 보내고 새 토큰도 메모리에만 보관합니다. reviewer는 Case·문서·심사·
finding 판단·정정 제안을 기록하고, approver는 다른 사람이 만든 제안을 승인 또는 반려한 뒤
자식 심사를 시작합니다. 제안자는 자신의 제안을 결정할 수 없습니다.

실제 기능 UAT는 Backend가 제공하는 OIDC 로그인만 사용합니다. 65법령 이력 Evidence·Data
저장소·Agent의 LLM(Claude 또는 OpenAI)이 동작하지만 결과는 항상 human review only이며,
통관 승인·배포 승인·릴리스 증거가 아닙니다.

## 실행

Node.js 22.12.x 이상 23 미만이 필요합니다. npm은 전역 설치하지 말고 Corepack이
`packageManager` pin에 따라 정확히 10.9.8을 사용하게 합니다. 아래 명령은 모두
`corepack npm`으로 실행합니다. 원하면 한 번 `corepack enable`을 실행한 뒤 같은 pin의
`npm` shim을 사용할 수도 있습니다.

    # customs-engineering-harness에서 한 번만 실행
    .\harness\eng.ps1 setup --repo frontend

그 다음 Frontend 저장소에서 실행합니다.

    corepack npm run dev:local

Backend 기본 loopback 주소는 `http://127.0.0.1:18081`입니다. 다른 주소로
실행할 때만 같은 PowerShell 창에서 BACKEND_ORIGIN을 지정합니다.

Functional UAT는 네 서비스가 문서의 순서대로 실행된 뒤에만 시작합니다.

    corepack npm run dev:functional-uat

Browser가 local Keycloak 로그인 화면으로 이동하면 사용자 이름
`local-functional-reviewer` 또는 `local-functional-approver`를 입력합니다. 역할에 맞는
비밀번호는 본인 PC의 Backend profile에서만 클립보드로 복사하고, 붙여넣은 뒤 바로 비웁니다.

```powershell
Set-Location ..\customs-backend
# reviewer 로그인용 (기본)
.\tools\Copy-FunctionalUatPassword.ps1
# approver 로그인용
.\tools\Copy-FunctionalUatPassword.ps1 -Actor approver
# Browser의 local Keycloak form에 붙여넣은 뒤
Set-Clipboard -Value ''
```

이 명령은 선택한 역할의 비밀번호 하나만 현재 사용자 clipboard에 넣고 화면·로그에는 값을
출력하지 않습니다. `_local/profiles/functional-uat/backend.env` 전체를 공유하거나
Agent/Data/DB 값으로 Browser를 설정하지 마십시오.

대표 여정은 Case 생성 → .txt 문서 등록 → 심사 시작 → 사람 검토 결과 확인
한 번입니다. 필요하면 AI 도우미 화면에서 결과에 연결된 문서 사실·비교·Evidence를
질문하고, 정정 제안을 독립된 approver가 승인한 뒤 자식 심사를 요청할 수 있습니다. 이 과정도
자동 승인이나 원문 변경으로 이어지지 않습니다. Browser는 심사 기준일을 보내지 않습니다. Backend가 개발 모드의
로컬 날짜를 정하거나 Functional UAT의 2026-08-05를 강제합니다.

## PDF·이미지 추출 미리보기

1단계 문서 화면에서 PDF, JPEG, PNG를 별도의 **추출 미리보기용 파일 등록**으로 올릴 수 있습니다.
Browser는 선택한 파일을 base64나 JSON으로 바꾸지 않고 Backend API v1에 raw body로만 전송하며,
Browser와 Backend는 16 MiB 이하만 받아들이고, Backend가 실제 MIME·magic byte·PDF 페이지·이미지 픽셀을 다시 검사합니다.

- 업로드와 추출 미리보기는 기존 텍스트 문서와 분리됩니다. 파일만 올리거나 추출을 요청해도 AI 심사,
  Finding, 통관 결론은 시작하거나 바뀌지 않습니다.
- 화면의 결과는 항상 **검증 전 추출 후보**입니다. 원본과 대조해 수정한 사람이 명시적으로
  `확인한 텍스트를 심사 문서로 등록`할 때만 기존 text-only 문서가 생성됩니다.
- 텍스트 등록 뒤에도 심사는 자동 실행되지 않습니다. 담당자가 기존의 `AI 심사 시작`을 별도로 눌러야 합니다.
- 원본 hash, 내부 저장 경로, 추출기 상세 revision, provider 오류는 화면에 표시하지 않습니다.

기본 profile에는 승인된 로컬 추출 엔진이 없을 수 있습니다. 이 경우 화면은 `추출 후보 제공 불가`로
끝나며 OCR 결과를 추정하거나 text-review로 우회하지 않습니다. OCR Gold의 사람 승인과 성능 승격은
별도 승인 Gate이며, 현재 Browser UI는 그 전 단계의 미리보기·사람 확인 경계만 제공합니다.

Review Run의 `temporal_context`(법령·HSK 품목 기준·수입/수출 요건 스냅샷의 세 날짜)는
현재 화면에 별도 패널로 표시하지 않습니다. 값이 없거나 `null`인 심사 이력도 그대로 읽을 수 있습니다.

## 실제 Browser E2E (현재 중단)

Backend의 `tools/run_functional_uat_browser_e2e.py`는 이 저장소의 `npm run functional-uat:browser`를
호출하도록 만들어져 있습니다. React 전환(ADR-0007) 때 Playwright 의존성과 이 스크립트를 제거했기 때문에
**지금은 실행할 Frontend 명령이 없어 Browser E2E가 동작하지 않습니다.** `scripts/check-static-boundaries.mjs`와
`scripts/doctor.mjs`도 `@playwright/test`를 허용하지 않습니다.

화면 확인은 `npm run test`(Vitest+jsdom)와 `dev/preview.html` 미리보기, 그리고 네 서비스를 띄운 수동 여정으로 합니다.
Browser E2E를 다시 도입하려면 의존성 정책(ADR)을 먼저 정한 뒤 이 스크립트와 Backend runner를 함께 복원해야 합니다.

## 선택적 정적 Docker smoke

`deploy/uat`의 Dockerfile은 Vite 개발 서버 대신 빌드된 정적 화면과 Nginx proxy를
확인할 때만 사용하는 선택 기능입니다. 기본 개발, 대표 Functional UAT, CI의 필수
단계나 배포 산출물이 아닙니다. 필요할 때만 `deploy/uat/README.md`의 build/run 절차를
따릅니다.

## 검사

    corepack npm run check:quick
    corepack npm run check:contract

check:contract는 이 저장소가 보관한 Backend OpenAPI 문서의 형식과, 필요할 때
지정한 Backend 원본과의 정확한 bytes 일치를 확인합니다. Backend API를 바꾼 경우에만
BACKEND_OPENAPI_FILE을 customs-backend/docs/openapi-v1.json으로 지정해
contract:generate를 실행합니다.

실행 중인 Functional UAT의 결과·원문·토큰·모델 cache는 Git에 넣지 않습니다.
각 팀원의 _local과 _artifacts 경계에만 둡니다. 자세한 전체 순서는 공용
Harness의 docs/local-setup.md를 따릅니다.
