# ADR-0001: Frontend는 Backend API만 소비한다

- Status: Accepted
- Date: 2026-07-14

## Context

AI Agent와 Data Platform은 내부 심사·근거 시스템이며 사용자 인증, tenant 격리, 파일 권한을 소유하지 않는다. 브라우저가 이를 직접 호출하면 내부 계약과 credential이 노출되고 서비스 상태를 일관되게 관리할 수 없다.

## Decision

Frontend는 Backend의 versioned public API만 소비한다. AI Agent, Evidence API, DB에는 직접 연결하지 않는다.

## Consequences

- Backend가 인증·권한·Case·Job·signed URL의 단일 진입점이 된다.
- Frontend는 Backend OpenAPI에서 client를 생성한다.
- 내부 Agent/Data 변경이 Frontend에 직접 전파되지 않는다.

