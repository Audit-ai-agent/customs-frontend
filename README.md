# Customs Frontend

팀 개발과 실제 기능 UAT를 위한 작은 Browser 작업대입니다. Browser는 Backend
API v1만 호출합니다. Agent, Data, PostgreSQL, Qdrant, Neo4j 주소나 비밀값을
Browser에 전달하지 않습니다.

## 두 실행 모드

| 명령 | 용도 | 필요한 입력 |
| --- | --- | --- |
| npm run dev:local | 기본 팀 개발 | 없음 |
| npm run dev:functional-uat | 실제 기능 UAT 화면 | Backend Functional-UAT와 OIDC 설정 |

기본 개발은 Backend의 loopback 전용 development session을 메모리에만
보관합니다. 공용 키, OIDC, Docker, 모델 cache, Law API 또는 Claude 키가
필요하지 않습니다.

실제 기능 UAT는 Backend가 제공하는 OIDC 로그인만 사용합니다. 실제 관세
3법·Data 저장소·Claude가 동작하지만 결과는 항상 human review only이며,
통관 승인·배포 승인·릴리스 증거가 아닙니다.

## 실행

Node.js 22.22.x 이상 23 미만과 npm 10.9.8이 필요합니다.

    # customs-engineering-harness에서 한 번만 실행
    .\harness\eng.ps1 setup --repo frontend

그 다음 Frontend 저장소에서 실행합니다.

    npm run dev:local

Backend가 기본 loopback 주소가 아닐 때만 같은 PowerShell 창에서
BACKEND_ORIGIN을 지정합니다.

Functional UAT는 네 서비스가 문서의 순서대로 실행된 뒤에만 시작합니다.

    npm run dev:functional-uat

Browser가 local Keycloak 로그인 화면으로 이동하면 사용자 이름
`local-functional-reviewer`를 입력합니다. 비밀번호는 본인 PC의 Backend profile에서만
클립보드로 복사하고, 붙여넣은 뒤 바로 비웁니다.

```powershell
Set-Location ..\customs-backend
.\tools\Copy-FunctionalUatPassword.ps1
# Browser의 local Keycloak form에 붙여넣은 뒤
Set-Clipboard -Value ''
```

이 명령은 reviewer 비밀번호 하나만 현재 사용자 clipboard에 넣고 화면·로그에는 값을
출력하지 않습니다. `_local/profiles/functional-uat/backend.env` 전체를 공유하거나
Agent/Data/DB 값으로 Browser를 설정하지 마십시오.

대표 여정은 Case 생성 → .txt 문서 등록 → 심사 시작 → 사람 검토 결과 확인
한 번입니다. Browser는 심사 기준일을 보내지 않습니다. Backend가 개발 모드의
로컬 날짜를 정하거나 Functional UAT의 2026-08-05를 강제합니다.

## 검사

    npm run check:quick
    npm run check:contract

check:contract는 이 저장소가 보관한 Backend OpenAPI 문서의 형식과, 필요할 때
지정한 Backend 원본과의 정확한 bytes 일치를 확인합니다. Backend API를 바꾼 경우에만
BACKEND_OPENAPI_FILE을 customs-backend/docs/openapi-v1.json으로 지정해
contract:generate를 실행합니다.

실행 중인 Functional UAT의 결과·원문·토큰·모델 cache는 Git에 넣지 않습니다.
각 팀원의 _local과 _artifacts 경계에만 둡니다. 자세한 전체 순서는 공용
Harness의 docs/local-setup.md를 따릅니다.
