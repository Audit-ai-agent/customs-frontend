# ADR-0006 — React 기반 상용형 AI 심사 경험과 안전 코어 분리

## 상태

TASK-0027에서 승인됨.

## 상황

기존 작업대는 Agent·Data 연동 결과를 재현하는 데에는 충분했지만, 한 화면에
진단 코드와 결과값이 많이 노출되어 사용자가 결론·원인·근거·다음 조치를
이해하기 어려웠습니다. 기존 Chat도 Case 결과 SHA 결박과 장문 구조화 답변을
위한 v2 계약을 소비하지 못했습니다.

동시에 기존 `/api/v1`, ReviewResult V3, OIDC, 복구 및 승인 로직은 이미 안전
경계로 검증되어 있으므로 화면 개선을 위해 이를 변경하면 안 됩니다.

## 결정

- 기존 작업대와 상용형 작업대를 기능 스위치로 분리합니다.
- 두 작업대는 각각 dynamic import하며 상용형 정적 로드 경로에 legacy
  `app.ts`, `styles.css`, `humanize()`가 포함되지 않도록 Vite manifest Gate로
  검증합니다.
- 상용형 작업대는 React 19, React Router, strict TypeScript와 명시적인 typed
  API client/reducer 상태를 사용합니다.
- 2026-07-27 보안 Gate에서 React Router DOM 7.18.1의 High 심각도
  RSC action CSRF advisory가 확인되어, 동일 Browser API를 직접 제공하고
  해당 advisory를 수정한 `react-router 8.3.0`으로 전환합니다. Vite도 확인된
  경로 탐색·개발 서버 advisory를 수정한 `8.1.5`로 고정합니다. 이 작업대는
  RSC action을 사용하지 않지만, 사용 경로와 별개로 dependency audit를
  fail-closed하기 위한 결정입니다.
- Browser는 Backend `/api/v1`과 `/api/v2`만 호출합니다. Agent·Evidence·DB
  주소나 credential은 알지 못합니다.
- 기본 화면은 한국어 업무 용어와 결론·과정·원인·근거·영향·조치·한계 순서를
  사용합니다. Profile, model, hash, store count는 접힌 검증 정보에 둡니다.
- 장문 보고서는 Agent가 검증한 `ReviewExperienceEnvelopeV1`만 표시합니다.
  계약을 읽지 못하면 같은 8개 구역의 결정론적 설명으로 안전하게 대체합니다.
- Chat은 `provider_result_sha256`에 결박된 Backend Chat v2만 사용하고, 검증이
  끝난 구조화 답변만 표시합니다.
- Citation은 종류별 업무 화면의 실제 target으로 이동하고 target에 키보드
  focus를 둡니다.
- 실제 단계는 Backend가 검증·영속한 SSE projection만 표시하며 가짜 진행률을
  만들지 않습니다.
- UAT Active capability는 자동완료를 활성화하지 않으며, 화면에는 계속
  `실제 법령 3종`, `자동 처리 꺼짐`, `내부 사용자 검증용` 경계를 표시합니다.

## 결과

- 사용자는 기술 문서 없이도 결과의 결론·이유·근거·다음 조치를 파악할 수
  있습니다.
- 기존 진단 작업대와 `/api/v1` 회귀는 유지됩니다.
- 실제 58종 법령, OCR, 법적 승인, Production 자동완료는 이 결정으로
  완성되지 않습니다.
- 실제 Browser Gate는 실행 중인 loopback UAT stack과 명시적인
  `CUSTOMS_E2E_LIVE=true`가 필요합니다.
