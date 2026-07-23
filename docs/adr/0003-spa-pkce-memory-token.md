# ADR-0003: SPA PKCE와 memory-only access token

- Status: Accepted
- Date: 2026-07-21

## Context

Backend는 Keycloak JWT를 검증하는 stateless Resource Server다. 정적 Frontend가 client secret을 가질 수 없고 `localStorage` token은 XSS 발생 시 장기 탈취 위험을 만든다.

## Decision

- Authorization Code + PKCE를 사용한다.
- Backend의 공개 `/api/v1/auth/config`에서 secret 없는 OIDC metadata를 받는다.
- access/id/refresh token은 in-memory store에만 둔다.
- OAuth state와 PKCE verifier만 callback 전까지 `sessionStorage`에 둔다.
- 보호 API 요청 직전에 access token의 남은 시간이 60초 이하면 refresh token으로 한 번 갱신한다. 동시 요청은 하나의 갱신 Promise를 공유하고, timer·iframe 기반 자동 갱신은 사용하지 않는다.
- 갱신 결과의 OIDC subject가 최초 로그인 subject와 다르거나 갱신이 실패하면 모든 in-memory credential을 폐기하고 재로그인을 요구한다.
- logout/clear와 진행 중 갱신은 session epoch로 결박한다. 늦게 끝난 갱신은 세션을 되살릴 수 없다.
- 제품 데이터는 Backend `/api/v1`만 호출한다. Keycloak authorization/token/end-session도 Workbench same-origin `/oidc/`를 통해 reverse proxy한다. SPA callback은 `/auth/callback`으로 분리한다.
- Production CSP의 `connect-src`·`form-action`은 `'self'`만 허용한다.

## Consequences

- 새로고침 시 token이 사라져 다시 인증해야 한다.
- 페이지가 유지되는 동안에는 provider의 refresh-session 한도 안에서 same-origin token endpoint를 이용해 세션을 갱신한다. refresh token도 새로고침을 넘어 보존하지 않는다.
- 임의 issuer/HTTP endpoint는 runtime decoder에서 거절한다. localhost만 개발 예외다. issuer·authorization·token·logout origin이 다르면 전체 config를 거절한다.
