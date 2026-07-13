# Architecture Boundary

```text
Browser
  └─ HTTPS / Backend OpenAPI
       ├─ Case / Document / Job
       ├─ HITL / Report / Chat
       └─ signed document URLs

Forbidden from Browser
  ├─ AI Agent internal API
  ├─ Evidence API
  └─ database ports or credentials
```

Frontend의 상태는 Backend의 canonical Case/Job 상태를 표현한다. AI의 내부 LangGraph node나 Data store 구조를 화면 상태로 직접 모델링하지 않는다.

보안 기준:

- 인증 token은 안전한 세션 전략을 통해 관리한다.
- 문서 URL은 짧은 만료시간과 권한 검사를 가진 signed URL만 사용한다.
- 사용자 수정은 원본 AI 결과를 덮어쓰지 않고 Backend audit event로 남긴다.
- bbox는 원본 페이지 크기·좌표계 version과 함께 표현한다.

