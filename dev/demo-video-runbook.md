# MVP 시연 영상 런북 (local-development)

4개 서비스(Data → Agent → Backend → Frontend)를 loopback dev-fixture로 띄우고,
KRDS React 작업대에서 대표 심사 여정을 녹화한다. Docker · LAW_API 키 · Claude 키 불필요.
결과가 결정론이라 재촬영해도 같은 화면이 나온다.

> **실제 스택(functional-UAT)으로 찍으려면**: 65법령 스토어가 이미 빌드돼 있으므로
> `powershell -ExecutionPolicy Bypass -File C:\Users\s0105\Documents\GitHub\_local\start-functional-uat.ps1 -SkipBuild`
> 한 방이면 전체가 UAT로 전환된다. 브라우저 → Keycloak 로그인
> (`local-functional-reviewer`, 비밀번호는 customs-backend의 `.\tools\Copy-FunctionalUatPassword.ps1`).
> 이 경로는 실 Claude 호출이라 **AI 심사가 수 분** 걸리고(진행 바가 그동안 떠 있음),
> 결과가 결정론이 아니다. 확인된 실측: CI 1장 업로드 → 심사 약 5분 → CCCT 요건
> "수입식품등 수입신고확인증" + 법령 Evidence 11건. dev로 돌아가려면 5173/18081/18083/18090
> 프로세스를 끄고 1번 절차대로 재기동.

> trade-doc-auditor의 65법령 지식 DB는 functional-UAT 경로에서만 쓴다.
> 이 MVP 데모는 합성 Evidence fixture로 충분하며, 실제 법령 연동 데모가 필요해지면
> Backend README의 functional-uat 절차를 따로 밟는다.

## 이 PC에 적용된 우회·패치 (알아둘 것)

1. **Windows Application Control이 backend venv exe를 차단**한다.
   `customs-backend-api.exe` 대신 아래처럼 python 모듈로 직접 실행한다 (터미널 3 참조).
2. **customs-backend에 커밋 안 된 로컬 패치** (`service.py`, `guidance_registry.py`).
   Agent의 dev-fixture guidance 인용(실제 registry ID + 합성 URI)을 Backend V2 검증이
   전부 409로 거부하던 cross-repo 버그 수정. 되돌리면 AI 도우미의 일반 안내 질문이
   409로 실패한다. → PR로 올려서 팀 승인 받을 것.
3. **customs-ai-agent에 커밋 안 된 변경**: `pypdf` 의존성 + 텍스트 레이어 추출
   adapter (`text_layer_preview.py`, `__main__.py` 주입). **두 serve 프로필
   (local-development·functional-uat) 모두 주입**하기로 결정됨 — 디지털 생성 PDF의
   텍스트 레이어만 추출하고, 스캔·이미지·암호화 PDF는 `unavailable`로 fail-closed라
   무측정 OCR 소스가 되지 않는다. → 역시 PR 대상.

## 1. 스택 기동 (터미널 4개)

공통: 새 PowerShell마다 실행 정책이 막으면 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

```powershell
# ── 터미널 1 · Data (포트 18083) ──────────────────────────────
cd C:\Users\s0105\Documents\GitHub\customs-data-platform
uv run --locked --no-sync --group dev python tools/run_dev_fixture_evidence.py --host 127.0.0.1 --port 18083

# ── 터미널 2 · Agent (포트 18090) ─────────────────────────────
cd C:\Users\s0105\Documents\GitHub\customs-ai-agent
. .\tools\Import-AgentProfile.ps1 -Profile dev-fixture
uv run --no-sync customs-ai-agent-dev-serve

# ── 터미널 3 · Backend (포트 18081) ───────────────────────────
cd C:\Users\s0105\Documents\GitHub\customs-backend
. .\tools\Import-LocalProfile.ps1 -Profile dev-fixture -Scope backend
# App Control이 venv exe를 막으므로 모듈로 실행:
uv run --no-sync python -c "from customs_backend.main import main; raise SystemExit(main())"

# ── 터미널 4 · Frontend (포트 5173) ───────────────────────────
cd C:\Users\s0105\Documents\GitHub\customs-frontend
corepack npm run dev:local
```

확인: `http://127.0.0.1:18081/health/ready` 가 `{"status":"ready", ...}` 이면 준비 끝.
브라우저에서 **http://127.0.0.1:5173** 접속.

> 프로필이 없다고 나오면 최초 1회: `uv run --no-sync customs-backend-profile-init --profile dev-fixture`
> (customs-backend에서. `GitHub\_local\profiles\dev-fixture\backend.env` 생성)

## 2. 시연 데이터 시딩 (선택 — 대시보드를 채우고 싶을 때)

7개 시나리오 Case(심사 완료·정정 승인·자식 심사 포함)를 실제 API로 만들어 넣는다.
Backend가 메모리 저장이라 **Backend 재시작 후 1회만** 실행 가능하다(고정 idempotency 키).

```powershell
# 터미널 2·3을 끄고, transcript 루트를 켠 채 다시 시작:
$env:CUSTOMS_SCENARIO_TRANSCRIPT_ROOT = 'C:\Users\s0105\Documents\GitHub\_local\state\scenario-runs'
$env:CUSTOMS_KNOWLEDGE_TRANSCRIPT_ROOT = 'C:\Users\s0105\Documents\GitHub\_local\state\scenario-runs\knowledge'  # Agent 터미널만
# (위 env를 각 터미널에서 설정한 뒤 터미널 2·3의 서비스 시작 명령을 그대로 실행)

# 그 다음 별도 터미널에서:
cd C:\Users\s0105\Documents\GitHub\customs-backend
uv run --locked --no-sync --group dev python tools/run_dev_fixture_scenarios.py --base-url http://127.0.0.1:5173/api/v1
# 기대 출력: "Scenario transcript complete: 8 passed; ..."
```

시딩 없이 빈 대시보드에서 Case를 처음부터 만드는 흐름으로 찍어도 된다 (아래 3-B).

## 3. 촬영 흐름 (6~8분)

### 3-A. 오프닝 (대시보드)
- `http://127.0.0.1:5173` — KRDS 정부 디자인의 심사 업무함.
- 말할 것: 통계 카드(전체/진행 전/사람 검토 중/종료), 처리 흐름 5단계,
  상태 필터·검색(`/` 단축키)·정렬.
- 강조: **Browser는 Backend API v1만 호출** — Agent·DB·비밀값은 브라우저에 없다.

### 3-B. 대표 여정 — 파일 업로드부터 심사까지 (핵심 데모)

시연용 PDF 8종이 `dev/demo-files/`에 있다 (없으면 `python dev/make-demo-pdfs.py`).

기본 4종 — 총중량·수량·원산지·컨테이너 불일치가 심어져 있어 심사에서 진짜 finding이 나온다:
`commercial-invoice.pdf` `packing-list.pdf` `certificate-of-origin.pdf` `bill-of-lading.pdf`

CO 변형 4종 — 원산지 검증·관세 진단 기능을 각각 자극한다:

| 파일 | 조합 | 화면에서 보이는 것 |
| --- | --- | --- |
| `certificate-of-origin.pdf` | 기본 CI(KR)와 함께 | 원산지 **불일치**(CO는 CN) — 오염 데이터 검출 |
| `co-kr-match.pdf` | 기본 CI(KR)와 함께 | 원산지 **일치**, FTA 대상국 아님 → 기본세율 유지 |
| `co-incomplete.pdf` | 아무 CI와 함께 | 증명서 번호·HS 코드 없음 → **검수 필요** 행 |
| `co-vn-match.pdf` + `commercial-invoice-vn.pdf` | 둘을 같이 (KR 송장 대신) | 원산지 일치 + **한-베트남 FTA 0% 적용** → 관세 진단에 절감액 표시 |

1. "＋ 새 Case 등록" → 제목 `8월 냉동새우 수입 신고 검토`, 참조번호 자유.
2. 1단계 **원본 파일 업로드 · 자동 추출** 패널에서:
   - 문서 유형 `Commercial Invoice` 선택 → `commercial-invoice.pdf` 업로드.
   - 업로드 즉시 자동 추출이 돌고 상태가 **"추출 완료 · 검수 필요"**로 바뀐다.
   - **추출 텍스트 검수·확정** 패널이 열림 — 추출된 원문 라인을 보여주고 수정 가능.
   - "검수 완료 · 문서로 확정" → 아래 서류 목록에 활성 문서로 등록된다.
   - 같은 방법으로 PL(`packing-list.pdf`) · CO · BL 3개 더. (영상 편집상 2개만 해도 흐름은 전달됨)
   - 멘트: "원본은 불변으로 보존되고, 사람이 검수·확정한 텍스트만 심사에 들어갑니다. HITL 경계."
3. 우상단 **"AI 심사 시작"** → 완료되면 자동으로 3단계 통관 심사로 이동.
   4개를 다 올렸다면 **불일치 5건**(수량·원산지·B/L 번호·컨테이너·총중량)이 검출된다.
4. 화면 요소를 순서대로:
   - **검토 필요 스탬프** — 자동 승인 없음, 항상 사람 검토.
   - **확인 사항** 카드: 심각도·비교값·문서 원문 인용 버튼 → **원문 대조 모달**
     (인용 위치 하이라이트) 시연.
   - **법령 Evidence** 카드와 출처.
   - 우측 **Agent 실행 트레이스** 레일: 처리 단계·제한형 계획·재추출 횟수.
5. 2단계 **교차 검증**: 비교 테이블 행 클릭 → 원문 위치 열림.
6. 확인 사항에 **담당자 판단 기록** (확인함/사유 입력) → 이슈바가 "판단 완료"로 바뀜.

### 3-C. AI 도우미
- 상단 GNB "AI 도우미" → 새 대화.
- 질문 예시 (dev-fixture 결정론 응답):
  - `이 사건에서 다음으로 확인할 것은?` → 사건 근거 답변 + 근거 칩(문서 사실/비교/Evidence).
  - `현재 사건의 문서 비교 결과와 일반 수출 신고 절차를 함께 설명해 주세요.`
    → **사건 분석 + 일반 안내(공식 registry 바인딩)** 혼합 답변. (Backend 패치가 살아있어야 함)
- 근거 칩 클릭 → 해당 비교/Evidence 화면으로 점프하는 것 시연.

### 3-D. 정정 제안 → 독립 승인 → 자식 심사 (거버넌스 포인트)
1. 심사자(기본 세션)로 확인 사항에서 **정정 제안 만들기** 기록.
2. 상단 유틸바 **개발 역할 → 승인자** 전환 (제안자는 자기 제안을 승인 못 함).
3. GNB "심사 이력" → 제안 카드에서 **승인** + 사유.
4. 승인된 제안 체크 → **"선택한 정정으로 재심사"** → 자식 심사 실행 생성.
5. 말할 것: 원문·부모 결과는 불변, 승인된 정정만 자식 실행에 반영, 계보(부모/자식) 표시.

### 3-E. 클로징
- 대시보드로 복귀 — 방금 만든 Case가 목록에.
- 멘트: "모든 결과는 사람 검토 보조이며 자동 통관 승인이 아니다. 4단계 관세 진단은
  Backend 계약이 준비되는 대로 같은 자리에 연결된다."

## 4. 재촬영 리셋

Backend가 메모리 저장이므로 **터미널 3의 Backend만 Ctrl+C 후 재시작**하면
Case가 전부 사라진 초기 상태가 된다. 시딩이 필요하면 2번을 다시 실행.

## 5. 알려진 한계 (영상에서 피할 것)

- **4단계 관세 진단 / HSK 분류 카드**: Backend v1 계약이 없어 "미지원" 빈 상태가 정상.
  화면 구조 설명용으로만 잠깐 보여줄 것.
- dev-fixture의 AI 답변은 결정론 fixture다 — 실제 Claude 아님. functional-UAT에서만 실제 모델.
- 좁은 창(<1024px)에서는 3단 워크스페이스가 안내 문구로 대체된다. 녹화는 1280px 이상 권장.
