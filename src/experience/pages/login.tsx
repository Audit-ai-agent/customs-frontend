import { Navigate } from "react-router";
import { useWorkbench } from "../context";
import { Icon } from "../icons";

export function LoginPage(): React.ReactElement {
  const { session, loading, error, login } = useWorkbench();
  if (session) return <Navigate to="/reviews" replace />;
  return (
    <main className="commercial-login" id="main-content">
      <section className="commercial-login__story">
        <div className="login-brand"><span>C</span><strong>통관 AI 사전심사</strong></div>
        <div>
          <p className="overline">내부 심사 담당자 작업대</p>
          <h1>문서부터 법령 근거까지,<br />한 흐름으로 확인합니다.</h1>
          <p>
            실제 Claude 문서 분석과 제한된 3종 법령 검색을 이용해 문서 불일치,
            규정 확인 사항, 담당자의 다음 조치를 이해하기 쉽게 정리합니다.
          </p>
        </div>
        <ol className="login-flow" aria-label="서비스 주요 기능">
          <li><span>01</span><p><strong>문서 분석</strong>통관 문서의 핵심 값을 읽고 연결합니다.</p></li>
          <li><span>02</span><p><strong>법령 근거 검색</strong>실제 데이터 저장소에서 관련 근거를 찾습니다.</p></li>
          <li><span>03</span><p><strong>담당자 협업</strong>설명, 질문, 수정, 재심사를 한곳에서 진행합니다.</p></li>
        </ol>
      </section>
      <section className="commercial-login__panel" aria-labelledby="login-title">
        <div className="login-card-commercial">
          <Icon name="shield" className="login-card-commercial__icon" />
          <p className="overline">보안 로그인</p>
          <h2 id="login-title">심사 작업대에 로그인합니다.</h2>
          <p>조직 계정으로 로그인하면 담당 권한에 맞는 심사 건만 확인할 수 있습니다.</p>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <button
            className="commercial-button commercial-button--primary commercial-button--wide"
            type="button"
            onClick={() => void login()}
            disabled={loading}
            data-testid="login-button"
          >
            {loading ? "로그인 상태 확인 중" : "조직 계정으로 로그인"}<Icon name="arrow" />
          </button>
          <div className="login-boundary">
            <strong>Local UAT · 운영 서비스 아님</strong>
            <span>텍스트 입력 · 실제 법령 3종 · 자동 처리 꺼짐</span>
          </div>
        </div>
      </section>
    </main>
  );
}
