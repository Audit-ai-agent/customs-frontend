# 체크포인트 로그 — KRDS 디자인 + 목업 UX 재구성

브랜치 `feature/krds-mockup-flow`. **로컬 커밋만 하고 push는 하지 않았습니다.**

확인 방법:

```powershell
Set-Location C:\Users\s0105\Documents\GitHub\customs-frontend
git log --oneline main..feature/krds-mockup-flow   # 체크포인트 목록
git show <해시>                                     # 체크포인트 하나 열어보기
corepack npm run dev:local                          # 서버 실행
# 브라우저에서 http://127.0.0.1:5173/dev/preview.html#/cases
```

스크린샷은 `dev/screenshots/`에 체크포인트 번호별로 있습니다.

목표: 통심 인터랙션 명세 v1.3(`trade-doc-auditor-origin/통심_인터랙션_명세.html`)의
**UX 플로우**를 따르되 **디자인은 KRDS**로. 근거 없는 값은 화면에 만들지 않고,
Backend에 없는 기능은 `customs-backend/docs/FRONTEND_UX_BACKEND_GAP.ko.md`에 요구사항으로 기록.

---

## CP1 — 목업 플로우 골격 이식

**한 일**

- 화면 모델을 탭 5개에서 **목업의 단계 흐름**으로 교체
  - 대시보드(FRAME 01) → 4단계 스테이지 워크스페이스(FRAME 02~05) → AI 도우미 / 심사 이력
  - 라우트: `#/cases`, `#/cases/:id/{documents|crosscheck|review|duty|assistant|history}`
  - 기존 `analysis`·`evidence` 링크는 alias로 계속 열립니다
- **대시보드**: KPI 4장(상태별 실카운트) · 처리 흐름맵 · 상태 필터 탭(카운트) · 검색(`/` 단축키) · 정렬 가능한 Case 표
- **3컬럼 워크스페이스**: 좌 서류 레일 / 중앙 캔버스 / 우 Agent 실행 트레이스(접이식)
- **스테이지 바**: 1 서류 등록 › 2 교차 검증 › 3 통관 심사 › 4 관세 진단, done/active 표시 + 미판단 건수 배지
- **이슈바**: 미판단 확인 사항 N건 표시, 전부 기록되면 초록으로 전환
- **원문 대조 모달**(FRAME 03b): 서류/인용 클릭 시 오버레이로 원문 + 인용 하이라이트. Esc·배경 클릭으로 닫힘
- **판정 도장**: 실행의 assessment/disposition과 미판단 건수를 반영
- 키보드: `1`~`4` 단계 이동, `←`/`→` 이전·다음 단계, `/` 검색 포커스, `Esc` 모달 닫기
- Backend 미지원 영역(HSK 분류, 관세 진단)은 가짜 값 대신 **미지원 사유 + 문서 링크** 표시

**시각 검증에서 잡아 고친 결함 3건**

1. 교차 검증 비교 표에서 규칙 코드가 옆 칸을 침범해 글자가 겹침 → 셀 단위 줄바꿈으로 수정
2. 스테이지 배지가 `margin-left:auto`로 칸 끝에 붙어 다음 단계 것처럼 보임 → 라벨 옆으로 이동
3. **원문 모달이 화면을 이동해도 닫히지 않음** → 라우트 변경 시 오버레이 해제

**검증** — lint · typecheck · 단위 테스트 12건 · production build 모두 통과.
테스트 1건은 의도한 설계 변경에 맞춰 갱신(Evidence 인용은 이제 `evidence` 전용 화면이 아니라
`review` 단계로 이동). 이유를 주석으로 남겼습니다.

**스크린샷** — `cp1-01-dashboard.png`, `cp1-02-review.png`, `cp1-03-crosscheck.png`,
`cp1-04-docmodal.png`, `cp1-05-history.png`

**다음** — 디테일 다듬기(밀도·정렬·빈 상태), 접근성 점검, 좁은 화면 검증.

---

## CP2 — 대화 문법 · 빈 상태 · 단계 완료 표시

**한 일**

- **AI 도우미 대화 정리**: 추천 질문을 밑줄 링크에서 **KRDS 알약형 칩**으로,
  담당자 말풍선을 파란 배경 흰 글씨로 바꿔 목업의 채팅 문법에 맞췄습니다.
- **빈 상태에 다음 행동 추가**: "아직 심사 결과가 없습니다"에서 끝나지 않고,
  문서가 없으면 `서류 등록 단계로 이동`, 있으면 `AI 심사 시작하기` 버튼을 함께 보여줍니다.
- **단계 완료 표시를 실제 진행 기준으로 교정** — 이전에는 현재 보고 있는 단계보다
  앞이면 무조건 "완료(초록)"로 칠해서, 아무것도 안 한 빈 Case에서도 1·2단계가
  완료로 보였습니다. 이제 서류 등록은 활성 문서 존재, 교차 검증은 실행 존재,
  통관 심사는 미판단 0건일 때만 완료입니다.
- 사라진 탭 모델을 가리키던 문구 정리("문서 탭" → "서류 등록 단계" 등)
- 프리뷰 스텁에 **빈 Case(case-2)** 추가 — 빈 상태를 실제로 눌러볼 수 있습니다.

**검증** — lint · typecheck · 테스트 12건 통과. 1024px 좁은 화면에서 트레이스 레일이
아래로 접히는 것까지 확인.

**스크린샷** — `cp2-01-duty.png`(미지원 단계 안내), `cp2-02-assistant.png`,
`cp2-03-review-1024.png`(좁은 화면), `cp2-04-empty.png`(빈 Case)

**다음** — 접근성(키보드 순회·대비), 모바일 폭, 로딩·오류 상태.

---

## CP3 — 가로 오버플로 · 포커스 링 · 모바일

여기서 나온 두 건은 눈으로만 봐서는 놓쳤을 실제 결함이라 브라우저에서 수치로 측정해 잡았습니다.

**한 일**

- **페이지 가로 스크롤 제거** — 390px에서 문서 폭이 393px로 넘쳐 화면 전체가 좌우로
  흔들렸습니다. 원인은 `QTY_MISMATCH_INVOICE_PACKING` 같은 **긴 규칙 코드가 줄바꿈되지
  않아** 카드 밖으로 밀고 나간 것. 확인 사항 제목에 줄바꿈을 허용하고 body에 가로 넘침
  차단을 걸었습니다. 9개 화면 × 390/1024/1440px 전부 `scrollWidth == clientWidth` 확인.
- **포커스 링 잘림 수정** — Case 표와 비교 표가 `overflow:hidden`이라 키보드 포커스
  테두리가 잘려 위쪽 선만 보였습니다. 링을 안쪽으로 그리도록 바꿔 사각형 전체가 보입니다.
  키보드만 쓰는 사용자에게는 지금 어디에 있는지가 안 보이던 문제입니다.
- **모바일 목록 정리** — 390px에서 KPI 카드가 4줄로 늘어지던 것을 2열로 유지하고,
  Case 행은 참조번호/제목을 쌓고 상태 배지를 오른쪽에 붙이도록 재배치.
- 키보드 단축키 실동작 확인: `→` 다음 단계, `3` 3단계 직행, `/` 검색 포커스(`/` 문자가
  입력창에 들어가지 않는 것까지 확인).

**검증** — lint · typecheck · 테스트 12건 · build 통과.

**스크린샷** — `cp3-01-mobile-dashboard.png`, `cp3-02-mobile-review.png`,
`cp3-03-focus.png`(포커스 링)

---

## CP4 — 통관 심사 화면 밀도

**한 일**

- 통관 심사 단계가 **5,386px(5.4화면)** 짜리 한 줄 스크롤이었습니다. 판정·확인 사항 같은
  실제 판단 작업이 Agent 서술 8개 구역과 원자료 밑에 파묻혀 있었습니다.
  → 참고 자료(Agent 보고서 전문, 심사 근거 상세)를 **접는 카드**로 내려 **2,893px**로 줄였습니다.
  접어도 DOM에는 남아 있어 근거 인용 이동은 그대로 동작합니다.
- 화면 순서를 판단 우선으로 재배치: 판정 도장 → 확인 사항 → 법령 Evidence → 이어서 할 일
  → (접힘) Agent 보고서 전문 → (접힘) 심사 근거 상세
- **판단 사유 입력창이 8줄 높이**로 벌어져 확인 사항 카드마다 화면 절반을 먹던 문제 수정.
  공용 textarea 헬퍼의 `rows="8"`이 인라인 폼에도 적용되고 있었습니다. 한 줄 높이로 고정.
- 접는 카드의 제목/설명/화살표가 그리드 자동 배치로 어긋나 제목이 오른쪽으로 밀리던 것 교정.

**검증** — lint · typecheck · 테스트 12건 통과. 보고서 8개 구역이 접힌 상태에서도
테스트가 찾는 `[data-report-section]` 8개가 유지되는 것 확인.

**스크린샷** — `cp4-01-review.png`(전체), `cp4-02-report-open.png`(보고서 펼침)

---

## CP5 — 처리 중 표시 · 라벨 정확도 · 남은 오버플로

**한 일**

- **처리 중 표시 추가** — 요청이 나가면 버튼만 비활성화되고 아무 신호가 없었습니다.
  화면 최상단에 얇은 진행 바를 띄웁니다(움직이는 요소는 이것 하나뿐).
- **버튼 라벨 정정** — 이미 심사 실행이 있는 Case에서도 "AI 심사 시작"이라고 적혀
  처음 실행하는 것처럼 보였습니다. 실행 이력이 있으면 **"AI 심사 다시 실행"**으로 바꿉니다.
- **남은 가로 오버플로 제거** — 390px에서 서류 등록·관세 진단 두 화면이 12px씩 넘쳤습니다.
  원인은 미지원 안내에 적어둔 파일 경로
  `customs-backend/docs/FRONTEND_UX_BACKEND_GAP.ko.md`가 끊기지 않는 한 덩어리라서.
  줄바꿈 허용으로 해결.
- 최종 확인: **8개 화면 × 390/1024px 전부** `scrollWidth == clientWidth`이고
  가로 스크롤 시도해도 `scrollX == 0`.

**검증** — lint · typecheck · 테스트 12건 · build 통과.

**스크린샷** — `cp5-01-notice.png`(완료 알림 + 다시 실행 라벨), `cp5-02-crosscheck.png`(교차 검증 표)

---

## CP6 — 승인자 역할 화면

**한 일**

- 프리뷰 스텁의 **역할 전환을 실제로 동작**하게 만들어 승인자 화면을 눌러볼 수 있게 했습니다.
  (유틸바 우측 `개발 역할 · 심사자 / 승인자`)
- 그 덕에 **버그 하나를 잡았습니다** — 심사 이력 화면에서 역할을 바꾸면 정정 제안 목록이
  빈 채로 남았습니다. 역할 전환이 Case를 다시 불러오면서 실행별 부속 데이터를 비우는데,
  현재 화면이 자기 데이터를 다시 채우지 않았습니다. 전환 직후 현재 화면의 로더를
  다시 돌리도록 수정. 승인자로 바꾸자마자 승인 대기 제안이 바로 보입니다.
- 승인자 화면 확인: 세션 표시가 `local-approver`로 바뀌고, `AI 심사 시작`이
  `심사자 역할에서 실행`로 비활성화되며, `선택한 정정으로 재심사`가 열립니다.

**검증** — lint · typecheck · 테스트 12건 통과.

**스크린샷** — `cp6-01-approver.png`

---

## CP7 — React + KRDS 전환 · functional-UAT 실연결

**한 일**

- **React 19 전환** — "React 금지" lint 계약을 사용자 승인 하에 교체하고
  `src/workbench.ts`(vanilla)를 `src/workbench.tsx` + `src/ui/*` 컴포넌트로 재작성.
  KRDS 시각언어는 `src/krds.css`, 모션은 `src/motion.css`로 분리.
- **functional-UAT 실연결 완료** — dev-fixture가 아닌 실제 스택으로 전체 여정이 돕니다:
  - 65법령 baseline 빌드 완주 (법령 65 · 조문 5,889 · CCCT 요건 14,726 · Qdrant 5,889 포인트),
    `verify-store` 통과. 전환 스크립트는 `_local\start-functional-uat.ps1`.
  - 전환 스크립트 결함 2건 수정: Agent 프로필명이 잘못돼(`functional-uat` →
    `functional-uat-law-history`) Agent가 즉사하던 것, 숨김 창에서 `python -c` 인용부호가
    깨져 Backend가 안 뜨던 것(`_local\run-backend.py` 런처로 대체).
- **CSP 수정** — functional-uat 모드에서 Keycloak(127.0.0.1:18088) 토큰 교환이
  `connect-src 'self'`에 막혀 로그인 후 부팅이 실패했습니다. `index.html`에
  `__CUSTOMS_AUTH_CONNECT_SOURCE__` 자리를 만들고 vite가 모드별로 치환합니다.
  local-development는 여전히 same-origin만 허용.
- **AI 워크플로 타임아웃 수정** — Backend가 심사 시작·재심사·AI 도우미 응답을
  요청 안에서 동기로 처리하는데(실 Claude 연결 시 수 분), 클라이언트 30초 타임아웃이
  요청을 중단시켜 "서비스가 준비되지 않았습니다"로 오인 표시됐습니다.
  이 세 호출만 10분 한도로 분리(`AI_WORKFLOW_TIMEOUT_MS`).

**E2E 스모크 (실제 스택, 전부 통과)**

Keycloak 로그인(`local-functional-reviewer`) → Case 생성 → `commercial-invoice.pdf`
업로드 → pypdf 자동 추출 → 검수·확정 → **실 Claude 심사** → 판정 "검토 필요" +
HSK 0303540000 실제 CCCT 요건("수입식품등 수입신고확인증" · 식약처) + 법령 Evidence
11건(관세법 제226조 등, law.go.kr 실출처 링크).

**검증** — lint · typecheck · 테스트 12건 · production build 통과.

---

## CP8 — HSK 분류 · 원산지(CO) 검증 · 관세 진단

Backend와 Frontend만 수정 (Agent 레포는 계약·코드 모두 그대로).

**Backend (customs-backend, 로컬 커밋 2건)**

- **파생 뷰 모듈 `trade_features.py`** — 저장된 실행의 불변 Agent 결과(문서 사실)와
  패키징 참조 데이터에서 세 화면 데이터를 계산. Agent 결과 해시는 절대 건드리지 않음.
- **HSK 분류** — `GET/POST /api/v1/review-runs/{id}/hs-classification`.
  후보는 `hs_code` 사실의 10자리 코드(신뢰도 = 문서 합치 비율), 품목명·분류 경로는
  관세청 HS부호 참조표(leaf 11,327개, `reference/hsk_names_20260101.json`).
  심사자 확정은 finding decision과 같은 즉시 확정 + 이력 보존.
- **원산지 검증** — `GET .../origin-verification`. CO 분석과 타 서류의
  증명서 번호·원산지·HS 코드 대조 + FTA 협정 대상국 힌트.
- **관세 진단** — `GET .../duty-assessment`. 출처·기준일 명기 세율 스냅샷
  (`reference/duty_rates_20260101.json`)으로 세율 사다리(기본/FTA)·요건 충족·
  서버 계산 세액(관세+부가세, 송장 통화)·절감액. 스냅샷에 없는 코드/총액 없음은
  **fail-closed** (`rates_unavailable`/`value_unavailable`).
- 검증: ruff·mypy·298 tests(신규 12)·contract 게이트 통과, OpenAPI 재생성.

**Frontend**

- 계약 재동기화(35 operations), client/decoders/types에 4개 메서드 추가.
- store: 실행별 lazy 로더 3개(`hs`/`origin`/`duty` 슬라이스, RUN_ATTACHMENT_RESET 포함),
  `recordHsSelection` 액션(확정 시 관세 진단 캐시 무효화), duty 단계 완료 판정.
- **1단계 HSK 카드** — 목업의 `.hsk/.cand/.conf-bar` 문법 그대로: 후보 행(코드·품목명·
  분류 경로·신뢰도 바·추천 핀) → 클릭 → 사유 입력 → 확정. 추천과 다른 코드로 확정하면
  경고 배너.
- **2단계 원산지 검증 카드** — 상태 배지 + 필드별 대조 행 + FTA 힌트(출처 링크).
- **4단계 관세 진단** — 미지원 안내를 실화면으로 교체: 세율 사다리(`best`/`applied`),
  서버 계산 세액 표, 절감 카드, FTA 요건 체크리스트(`req have/need`), 세율 출처.
  fail-closed 상태는 이유를 설명하는 빈 상태로.
- `constants.ts` stage 4 `supported: true`. 검증: lint(29 files)·typecheck·테스트 13건·build 통과.

**E2E (functional-UAT 실스택)** — 기존 스모크 Case에서 HSK 후보 표시(고등어 0303540000,
신뢰도 1.00, 추천) → 확정(사유 기록, 핀 "확정" 전환) → 원산지 검증(CO 없음 상태 +
FTA 힌트) → 관세 진단(기본세율 10% 현재 적용, FTA 0% 요건 미충족, USD 30 기준
관세 3 + 부가세 3.3, 절감 가능 USD 3 + 미충족 요건 표시)까지 전부 실 API로 동작.

**스크린샷** — `cp8-01-duty.png`, `cp8-02-hsk.png`

**한계(다음 단계)** — 세율 스냅샷은 데모 코드 2종(0303540000·7318151000)만 수록.
환율·인코텀즈·TRQ 미반영(송장 통화 기준). CO 문서까지 올린 4문서 여정은 재심사 후
확인 가능.

---

## CP9 — 종료 플로우 · UX 디테일 · 세션 수명 · 합성 CO 데이터셋

**세션 수명 (로그인 만료 해결)**

- Keycloak realm 기본값(액세스 토큰 5분·SSO 유휴 30분)이 데모 중 재로그인을 강요
  → realm 생성기와 생성된 realm에 액세스 1시간·세션 12시간을 명시, 컨테이너 재생성으로 적용.
- 프런트 OIDC는 `automaticSilentRenew` + 만료 시 즉석 refresh 1회로 백그라운드 갱신.
  토큰은 여전히 메모리에만.

**종료 플로우 (여정의 마지막 단계 신설)**

- Backend `POST /api/v1/cases/{id}/closure`: 심사 실행 존재 + 전 확인 사항 판단 완료 시
  심사자가 처리 방향(검토 종결/반려)과 사유로 Case를 closed로 확정. 중복 종료 409,
  종료 후 재심사 차단, 어디에도 전송하지 않음. 테스트 3건.
- 통관 심사 화면 하단 "심사 종료" 카드: 조건 미충족 안내 → 폼 → 종료 후 읽기 전용 기록.
  실스택에서 VN 데모 Case 실제 종료로 검증.

**UX 디테일 일괄**

- 대시보드 처리 흐름도를 Case 목록 아래로 이동.
- 판단 기록 알림을 "기록했습니다."로 축약.
- **업로드 확정 후 "추출 전" 잔류 버그 수정** — Case 재로딩이 추출 상태를 버리던 것.
  세션 상태 보존 + "문서로 확정됨" 배지(이전 세션 확정도 파일명으로 인식).
- `body{word-break:keep-all}` — "협정세율"의 "율"만 내려가던 한글 어절 끊김 제거.
- 세율 사다리 행 한 줄 고정(배지가 아랫줄로 떨어지지 않음).
- 상태 라벨 "사람 검토 중" → "검토 중".
- 심사/재심사 실행 중 트레이스 레일에 경과 시간 + 예정 단계(대기) 표시.
  단계별 실시간 이벤트는 Agent 스트리밍 계약이 필요해 gap 8항으로 유지.
- 네이티브 셀렉트에 KRDS 스타일(셰브론·호버·포커스) 적용.

**합성 CO 데이터셋 (통관서류_합성데이터셋_2000세트 v2)**

- error_sets 1,000세트 전부에 `E####_CO.pdf` 추가 — 각 세트의 manifest 기준 데이터로 생성
  (수출자·수하인·운송·송장번호·품명·수량 + 원산지 REPUBLIC OF KOREA).
- 이 중 **343세트에 CO 전용 오류 1건씩 결정론 주입** + `error_labels.csv` 라벨
  (`CERTIFICATE_OF_ORIGIN`, num_errors_in_set 반영): 원산지 불일치 87 · 수하인 100 ·
  송장번호 80 · 품명 76. 총 라벨 1,634 → 1,977건, summary 갱신.
- 검증: 라벨 343건 전부 PDF 본문과 일치, num_errors_in_set 정합 100%,
  pypdf 텍스트 레이어 추출 확인(업로드 파이프라인 호환). 재생성 `make_error_co.py`(seed 고정).

**검증** — backend ruff·mypy·289 tests·contract 게이트 / frontend lint·typecheck·13 tests·build 통과.

---

## CP10 — 법령 검색 확장 · AI 관련성 필터 · 실시간 트레이스 (Agent 승인 하 수정)

- **top_k 10 → 30** (`customs-ai-agent/profiles.py`) — 검색 재현율 확대.
- **AI 관련성 필터** — functional-uat에서 Claude 1회 호출로 검색 결과 중 이 사건 판단에
  필요한 법령만 선별. 요건 evidence(eligibility=finding)는 절대 제외하지 않고,
  필터 실패는 전체 유지(fail-open). 실측: 동일 Case에서 evidence 11건 → **7건**.
- **실시간 트레이스** — Agent가 동기 심사 중 스레드 안전 진행 레지스트리에 단계 전이를
  기록하고 `GET /internal/agent/v3/reviews/{id}/progress`로 노출. Backend가
  `GET /api/v1/cases/{id}/review-progress`로 프록시(3초 타임아웃·실패 시 무해 강등),
  프런트가 실행 중 2초 간격 폴링으로 우측 레일에 단계별 대기/진행 중(펄스)/완료를 표시.
  실측: 실행 37초 시점에 단계 완료가 실시간 반영. 진행 상태는 심사 결과에 절대 개입하지 않음.
- Agent 커밋 2건(기존 pypdf adapter 분리 + 본 기능), Agent 291 · Backend 289 · Frontend 13 테스트 통과.

---

## CP11 — 전체 사이트 구조 · 운영 지표 · 로그인 화면 · UAT 시연 검증 (2026-08-18)

**사이트 구조 (KRDS 재확인 후 설계)**

- GNB를 7항목 전체 구조로 확장: **홈(#/home, 기본 랜딩) · 심사 업무함 · HSK 분류 참조 ·
  법령 조회 · 심사 기록 · 운영 지표 · 이용안내**. Case 화면 메뉴(워크스페이스/도우미/이력)는
  KRDS 2단계 원칙대로 GNB에서 빼서 Case 내부 서브탭으로. 브레드크럼은 실제 링크가 됐고
  "통관심사" 장식 항목은 제거. 로그인 화면(FRAME 00) 신설 — functional-uat는 "기관 계정으로
  로그인" 버튼 후에만 OIDC 리다이렉트, 팀 개발 모드는 심사자/승인자 역할 선택형.
- **법령 조회**: 각 Case 최신 실행이 실제 인용한 법령 Evidence를 법령별로 모아 검색·표시
  (Browser는 법령 DB 직접 접근 불가 — 인용된 것만, 원문 검색은 공식 출처 링크로).
- **운영 지표 실구현**: Backend `GET /operations-metrics` 집계 계약 신설(상태별 Case,
  실행 판정 분포, 최신 실행 기준 확인 사항 처리율, 종료 처분, 14일 무공백 일별 시계열) —
  gap 문서의 "대시보드 운영 지표" 항목 해소. 화면은 단일 색조 막대·미터·컬럼.

**HSK 검색 (backend `GET /hsk-reference?q=` + 콤보박스)**

- 코드 접두어/품명 타이프어헤드 + 품명 역검색. 정확도 평가로 3개 개선: 부분일치 폴백
  (`partial` 플래그 + 화면 안내), 조상 영문명 인덱싱+라틴 단어경계, 한국어 복합어 분해·동의어.
  실측: 영문 송장 품명 12종 Top-1 0/12 → 6/12, 참조표 자가 역검색(고유명) R@12 1.000.

**UX·표기**

- 심사 완료 시 3단계 강제 이동 제거 — 제자리 데이터 갱신 + 알림 + 이슈바 칩으로 이동 위임.
- 모션 시스템: 속도 토큰 5단계·이징 2종·트리거 규칙을 motion.css에 명문화, 죽은 목업
  셀렉터 정리, 단계 전환 방향성/GNB 밑줄 슬라이드/게이지 채움/판정 도장 등 배선.
- "법령 Evidence" → **"법령정보"** 전면 교체. 보안 고지 문구는 로그인·푸터에서 제거
  (이용안내 › 책임 범위로 일원화).

**UAT 시연 검증 (실스택 E2E, E0001 합성 세트)**

- Keycloak 로그인 → Case 생성 → 4문서 등록 → 실 Claude 심사: 주입 오류 2건(수량 32,222↔64,444,
  총액 불일치)을 '높음' 확인 사항으로 정확 검출, 확인 사항 12건 · 교차 검증 15행.
- HSK 품명 매칭 후보에서 6109101000 확정 → 재심사 → **확정 코드 기반 법령정보 5건**
  (관세법 232·237·245·249조, 시행령 236조, law.go.kr 링크).
- 그 과정에서 **Agent 버그 수정**(`e521bf5`): CO의 "REPUBLIC OF KOREA" 같은 비 ISO-2
  원산지가 Data retrieve를 422로 전멸시키던 것 — ISO-2가 아니면 원산지 없음으로 강등.
- PDF 자동 추출은 리베이스 이후 OCR 승인 게이트(승인 포인터 없음)로 비활성 —
  시연 데이터는 텍스트 등록 경로 사용. 승인 파이프라인은 9/30 예정 항목.

**환경 (git 밖, 이 PC 로컬)**

- data-platform venv torch를 `2.13.0+cu126`으로 교체하고 Data 서비스를 `--allow-cuda`로
  기동(upstream에 이미 있는 opt-in 플래그). `_local\start-functional-uat.ps1`에 반영.
  단건 검색은 4.5→4.1s(병목은 파이프라인 구조), 배치 빌드·평가에 유효. **주의:
  `uv sync` 시 +cpu로 되돌아감** — uv.lock 정식 반영은 push 권한 확보 후 PR로.
- Backend 좀비 job 이슈: 심사 요청 중 브라우저 리로드 시 job이 running으로 남아
  이후 요청이 이를 재사용 — Backend 재시작으로 해소. 근본 처리는 미착수.

---

## 남은 것 (제가 손대지 않은 부분)

- **functional-UAT 브라우저 e2e 재작성** — main의 playwright e2e 패키지(e2e/ 스펙,
  presentation.ts, 설정)는 React 재작성 이전의 탭 UI·구 클라이언트 API를 전제로 해서
  이 브랜치 화면에서는 실행 불가라 main 병합 시 제외했습니다. 새 UI(홈/서브탭/단계
  라우트) 기준으로 다시 작성해야 합니다.

- **Backend 공백 8건** — `customs-backend/docs/FRONTEND_UX_BACKEND_GAP.ko.md`.
  특히 목업 4단계(관세 진단)는 계약이 통째로 없어 화면을 비워 뒀습니다.
- ~~두 저장소 API v1 세대 불일치~~ — **CP7에서 해소.** Backend가 `bd0b893`으로 올라오고
  계약(`contracts/backend-openapi-v1.json`)을 재동기화해 실제 Backend에 붙습니다.
  단, customs-backend·customs-ai-agent에 **커밋 안 된 로컬 패치**가 있습니다
  (`dev/demo-video-runbook.md` 상단 "이 PC에 적용된 우회·패치" 참조 — PR로 올릴 것).
- **로그인 화면** — 목업 FRAME 00에 해당하지만 이 앱은 OIDC/개발 세션이 처리하므로
  만들지 않았습니다.
