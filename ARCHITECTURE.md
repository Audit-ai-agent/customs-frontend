# Frontend boundary

Browser → same-origin API v1 → Backend → Agent → Data

- Browser는 Backend만 호출한다. 내부 Agent/Data HTTP, DB, 모델, Law API에는
  직접 연결하지 않는다.
- local-development는 Backend loopback development session을 메모리에만
  보관한다. Functional UAT만 OIDC 메모리 세션을 사용한다.
- 결과는 Backend public API projection으로만 표시한다. Browser는 Agent/Data
  내부 설정, 모델 정보 또는 Data 원문을 해석하거나 검증하지 않는다.
- 모든 심사 결과는 사람 검토 보조 정보다. 자동 완료 UI는 없다.

contracts/backend-openapi-v1.json은 Backend public OpenAPI의 byte-for-byte
consumer snapshot이다. 이 계약은 API 변경 시에만 갱신한다.
