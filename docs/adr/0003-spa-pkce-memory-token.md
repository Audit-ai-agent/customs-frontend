# ADR-0003: SPA PKCE와 memory-only access token

- Status: Accepted
- Date: 2026-07-21

## Context

Backend는 Keycloak JWT를 검증하는 stateless Resource Server다. 정적 Frontend가 client secret을 가질 수 없고 `localStorage` token은 XSS 발생 시 장기 탈취 위험을 만든다.

## Decision

- Authorization Code + PKCE를 사용한다.
- Backend의 공개 `/api/v1/auth/config`에서 secret 없는 OIDC metadata를 받는다.
- access/id token은 in-memory store에만 둔다.
- OAuth state와 PKCE verifier만 callback 전까지 `sessionStorage`에 둔다.
- 제품 데이터는 Backend `/api/v1`만 호출한다. Keycloak authorization/token/end-session도 Workbench same-origin `/oidc/`를 통해 reverse proxy한다. SPA callback은 `/auth/callback`으로 분리한다.
- Production CSP의 `connect-src`·`form-action`은 `'self'`만 허용한다.

## Consequences

- 새로고침 시 token이 사라져 다시 인증해야 한다.
- 지속 로그인 UX가 필요해지면 silent renew 또는 Backend-for-Frontend 세션을 별도 보안 검토한다.
- 임의 issuer/HTTP endpoint는 runtime decoder에서 거절한다. localhost만 개발 예외다. issuer·authorization·token·logout origin이 다르면 전체 config를 거절한다.
