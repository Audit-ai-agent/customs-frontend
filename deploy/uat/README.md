# Functional-UAT static frontend

이 Dockerfile은 Vite 개발 서버 대신 이미 빌드한 화면을 loopback Functional
UAT에서 확인할 때만 쓰는 선택적 정적 화면 smoke입니다. 배포 이미지나 릴리스
산출물이 아니며, 전체 UAT Compose는 존재하지 않습니다.

- Corepack의 npm 10.9.8로 `corepack npm run build:functional-uat`를 실행해 빌드합니다.
- 컨테이너 내부 포트는 5173뿐이며, 실행자가 `127.0.0.1:5173`로 명시해
  publish합니다.
- API v1만 loopback Backend로 proxy합니다. Keycloak은 Backend가 반환하는
  `127.0.0.1:18088` OIDC endpoint를 Browser가 직접 사용합니다.
- Agent·Data URL, Law API credential, Claude key, 모델 cache를 포함하지
  않습니다.
- 결과는 항상 사람 검토용입니다.

일상 개발에는 Docker가 필요 없습니다. `corepack npm run dev:local`을 사용하십시오.
기능 UAT에서 Vite 대신 이 화면을 확인할 때만 다음처럼 실행합니다(Docker
Desktop 기준).

```powershell
docker build -f deploy/uat/Dockerfile -t customs-frontend-functional-uat:local .
docker run --rm --name customs-frontend-functional-uat -p 127.0.0.1:5173:5173 `
  -e BACKEND_ORIGIN=http://host.docker.internal:8080 customs-frontend-functional-uat:local
```

Backend·Agent·Data와 local Keycloak은 먼저 각 저장소의 Functional UAT 순서대로
준비해야 합니다. 이 컨테이너에는 비밀, 모델, 원문, Docker volume이 들어가지
않습니다.
