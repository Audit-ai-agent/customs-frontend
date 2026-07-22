# ADR-0002: 최소 TypeScript 작업대와 좁은 API 계약

- Status: Accepted
- Date: 2026-07-21

## Context

현재 목표는 범용 디자인 시스템이나 고객용 전체 Frontend가 아니라 내부 심사자가 Agent의 전체 text-first 흐름을 확인하는 최소 작업대다. Backend API와 Agent V3가 동시에 안정화되는 동안 무거운 UI 프레임워크와 자동 생성 client를 먼저 고정하면 불필요한 결합이 생긴다.

## Decision

- Vite + strict TypeScript + 안전한 native DOM으로 구현한다.
- 소비하는 Backend 경로만 checked-in JSON contract와 TypeScript type/decoder로 관리한다.
- 실제 Backend OpenAPI와 path/method/operationId drift를 CI에서 비교한다.
- XSS 방지를 위해 HTML 문자열 렌더링을 금지한다.
- UAT 시나리오는 Frontend build에 포함된 합성 텍스트이며 일반 Case/Document/Review API로만 실행한다.

## Consequences

- 의존성과 build가 작고 UI의 보안·상태 경계를 직접 검증할 수 있다.
- Backend schema의 전체 표면을 Frontend에 복제하지 않는다.
- 복잡한 화면·상태가 증가하면 별도 ADR로 component framework 도입을 재검토한다.
