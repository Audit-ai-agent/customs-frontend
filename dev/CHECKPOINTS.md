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
