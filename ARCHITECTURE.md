# Frontend boundary

Browser → same-origin API v1 → Backend → Agent → Data

- Browser는 Backend만 호출한다. 내부 Agent/Data HTTP, DB, 모델, Law API에는
  직접 연결하지 않는다.
- local-development는 Backend loopback development session을 메모리에만
  보관한다. Functional UAT만 OIDC 메모리 세션을 사용한다.
- 결과는 Backend public API projection으로만 표시한다. Browser는 Agent/Data
  내부 설정, 모델 정보 또는 Data 원문을 해석하거나 검증하지 않는다.
- 모든 심사 결과는 사람 검토 보조 정보다. 자동 완료 UI는 없다.
- Agent V3.2의 8개 보고서 구역과 bounded planner trace는 Browser가 새로 조합하지 않고
  Backend가 저장한 결과 그대로 표시한다. 주장마다 fact·comparison·Evidence ID를 눌러
  기존 상세 화면으로 이동한다.

contracts/backend-openapi-v1.json은 Backend public OpenAPI의 byte-for-byte
consumer snapshot이다. 이 계약은 API 변경 시에만 갱신한다.

## AI 도우미와 정정 제안

AI 도우미도 Browser → Backend v1 경계를 벗어나지 않는다. Browser는 대화나
정정 제안을 로컬 저장소에 보관하지 않으며, Agent·Data에 직접 질문하지 않는다.

- 대화: `GET/POST /api/v1/review-runs/{review_run_id}/assistant/conversations`
- 메시지: `GET/POST /api/v1/assistant/conversations/{conversation_id}/messages`
- 정정 제안: `GET/POST /api/v1/review-runs/{review_run_id}/correction-proposals`
- 승인·반려: `PUT /api/v1/correction-proposals/{correction_proposal_id}/decision`
- 자식 심사 요청: `POST /api/v1/review-runs/{review_run_id}/revisions`

메시지는 이미 저장된 review run의 사실·비교·Evidence ID만 인용한다. 인용을
누르면 기존 문서·AI 심사·근거 탭으로 이동한다. 정정 제안은 원문이나 부모 심사
결과를 수정하지 않는다. 담당자가 승인한 제안만 revision Job으로 보낼 수 있고,
완료된 Job의 `review_run_id`가 새 자식 심사 실행을 가리킨다.

reviewer는 Case·문서·심사·finding 판단·정정 제안을 만들고, approver는 읽기·대화와
다른 사람이 만든 정정 제안의 승인·반려·자식 심사만 수행한다. local-development는
loopback 전용 `POST /api/v1/dev/session`의 reviewer 기본값과 명시적인 approver 선택만
사용하며, Functional-UAT는 동일한 두 OIDC 역할을 사용한다. Browser는 제안자가 자신의
제안을 결정하는 UI를 표시하지 않는다.

현재 Frontend가 기대하는 응답 투영은 Backend가 소유한다. Assistant 답변에는
`answer_scope`, `citations`, `suggested_questions`, 선택적 `correction_draft`가
있고, 정정 제안에는 `correction_proposal_id`, `new_value`,
`proposed|approved|rejected` 상태, 선택적 `applied_review_run_id`와
`proposed|approved|rejected|applied` lifecycle 이력이 있다.
Backend OpenAPI가 이 경로를 포함하도록 갱신된 뒤에만 consumer snapshot을 다시
생성한다.
