# Customs Frontend

통관 문서 심사 서비스의 사용자 작업대를 위한 독립 저장소다. 현재 단계에서는 저장소 경계와 협업·CI 기준만 구축했으며 제품 Frontend 프레임워크와 화면은 아직 구현하지 않았다.

## 책임

- 문서 업로드와 Case 목록·상세
- PDF/이미지 원문과 bbox 하이라이트
- 추출값 수정과 재검증 요청
- HITL 검토·승인
- XAI 리포트와 Case-bound Chat
- Backend OpenAPI에서 생성한 TypeScript client
- 접근성·단위·브라우저 E2E 테스트

## 금지된 연결

Frontend는 Backend API만 호출한다. AI Agent, Evidence Service, PostgreSQL, Qdrant, Neo4j를 직접 호출하거나 credential을 보유하지 않는다.

현재 프로젝트의 `agent_webui.html`은 Mock Agent와 Live RAG/DB 연결을 보여주는 localhost 개발 도구이며 제품 Frontend가 아니다. 이 저장소로 복사하지 않는다.

## 현재 상태

`repository-foundation-only`: 프레임워크 선택 전이며 제품 코드는 없다. 프레임워크 선택은 Backend public API와 UX 요구사항이 확정된 후 별도 ADR에서 결정한다.

