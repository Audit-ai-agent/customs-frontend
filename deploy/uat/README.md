# Frontend LOCAL USER UAT container

이 경로는 Production `Dockerfile`과 의도적으로 분리된 개발자·사용자 UAT 전용
정적 실행 경계다. Vite 개발 모드의 inline style 주입을 사용하지 않고, build 단계가
만든 hashed JavaScript·외부 CSS를 Nginx가 엄격한 CSP 아래에서 제공한다.

- Node `22.23.1`, npm `10.9.8` exact build image에서 두 Enhanced 기능 스위치를
  활성화하고 `npm run build:uat`를 실행한다.
- runtime은 digest로 고정한 unprivileged Nginx이며 컨테이너 내부 `5173`에만 bind한다.
- 전체 UAT Compose만 `127.0.0.1:18088:5173`으로 publish한다. 이 Dockerfile 자체는 host port를 결정하지 않는다.
- `/api/v1`, `/api/v2`와 `/oidc`는 각각 필수 `BACKEND_ORIGIN`,
  `OIDC_BACKEND_ORIGIN`으로 proxy한다.
- Browser에 Backend 외의 Agent·Data URL이나 credential을 전달하지 않는다.
- `style-src 'self'`를 유지하며 `unsafe-inline`로 CSP를 약화하지 않는다.
- `com.customs.production=false`, `com.customs.auto-completion=off` label을 갖고 Production image 또는 Release 근거로 사용할 수 없다.

Compose service의 최소 결박 예시는 다음과 같다.

```yaml
frontend-uat:
  build:
    context: <customs-frontend-root>
    dockerfile: deploy/uat/Dockerfile
  environment:
    BACKEND_ORIGIN: http://backend-uat:8080
    OIDC_BACKEND_ORIGIN: http://keycloak-uat:8080
  ports:
    - "127.0.0.1:18088:5173"
```

두 origin은 credential·path·query·fragment가 없는 HTTP(S) origin이어야 한다. 실제 조합과 network는 개인 `_engineering` UAT harness가 소유한다.

Browser E2E는 저장소 밖 `_secrets/uat/credentials.json` 또는 명시적인 외부
`CUSTOMS_E2E_CREDENTIALS_FILE`에서 reviewer 계정을 읽어 실제 Keycloak
Authorization Code + PKCE 흐름을 통과한다. Token은 계속 Browser 메모리에만
존재하므로 `storageState`로 우회하지 않으며, credential 입력이 증거에 남지
않도록 Playwright 자동 trace·video·screenshot을 비활성화한다. 현재 Harness
실행의 exact 9개 Case·Review Run·결과를 묶은
`CUSTOMS_E2E_SCENARIO_BINDINGS_FILE`과 그 파일의
`CUSTOMS_E2E_SCENARIO_BINDINGS_SHA256`도 필수다. 성공 증거용 명시적 화면
캡처는 질문·답변·보고서 본문·입력란·기술 상세를 마스킹한 뒤에만 첨부한다.
