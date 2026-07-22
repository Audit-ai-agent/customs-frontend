# ADR-0004: Evidence-bound UI와 승인된 Revision

- Status: Accepted
- Date: 2026-07-22

## Context

AI 응답 문장과 수정 제안을 그대로 표시·적용하면 사용자가 근거를 재현할 수 없고, 이전 Run의 불변성과 승인 권한도 무너진다. 수작업으로 요약한 독자 OpenAPI 계약은 Backend의 실제 Schema와 동기화되지 않을 수 있다.

## Decision

- Backend exact commit에서 export한 OpenAPI 전체를 canonical JSON으로 고정하고 TypeScript type을 생성한다.
- UI는 추출 field, source span, issue, Evidence, Finding을 Run-local stable ID로 연결한 `source ledger`를 렌더링한다.
- Issue·Finding은 배열 위치가 아니라 제공된 stable reference ID에 결박한다. 레거시 응답은 종류·code·message·document가 유일하게 일치할 때만 허용하며 누락·중복·종류 불일치는 fail-closed한다.
- Narrative, Chat, required action에 unknown citation ID가 있거나 material claim의 citation이 없으면 응답을 fail-closed한다.
- Reviewer는 다섯 결정 유형을 명시한 `RevisionProposal`(`confirm_field`, `correct_field`, `add_supporting_document`, `approve_review`, `reject_review`)만 생성한다. Frontend에서 direct revision이나 replay-idempotent하지 않은 legacy Run decision endpoint를 호출하지 않는다.
- Approver가 parent result digest·Agent input manifest·Case revision을 다시 검증해 승인한 경우에만 Backend이 child Job을 생성한다.
- Review enqueue와 proposal decision은 사용자 intent별 안정적 idempotency key를 재시도에서 재사용한다.
- 응답 유실 또는 `delivery_uncertain`이면 최소 복구 식별자만 sessionStorage에 저장하고 해당 Case의 새 intent를 차단한다. 자동 새 요청은 금지하고 저장된 Job 조회 또는 동일 key 수동 재전송으로 대조한다.
- `delivery_uncertain` 해제는 Backend Approver 권한의 별도 reconciliation 전이로만 수행한다. 현재 Case·Job·복구 식별자와 미수신 증거 hash를 결박하고 `failed + delivery_reconciled` 응답이 확인될 때만 로컬 차단을 해제한다.
- SSE는 인증된 `fetch` stream으로 소비하고, Job polling을 authoritative fallback으로 유지한다.

## Consequences

- Backend 계약이 변하면 snapshot·generated type·lock을 함께 갱신하고 diff를 검토해야 한다.
- 근거가 잘못된 AI 설명은 부분적으로 보여주지 않고 계약 오류로 처리된다.
- Event stream 장애는 진행 표시를 제한하지만 Job 실행·완료 확인을 중단하지 않는다.
- 일시적 polling 실패는 bounded exponential backoff 후에도 복구 상태를 보존하므로 운영자가 미확정 intent를 잃지 않는다.
- reconciliation 응답 유실이나 식별자 불일치는 원상태를 유지하므로 중복 Agent 호출보다 사람 확인을 우선한다.
