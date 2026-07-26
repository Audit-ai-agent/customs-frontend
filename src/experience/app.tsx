import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import type { CommercialDependencies } from "./context";
import { WorkbenchProvider, useWorkbench } from "./context";
import { ApplicationFrame } from "./layout";
import { CaseWorkspace, PageError, PageLoading } from "./case-context";
import { AssistantPage } from "./pages/assistant";
import { DocumentsPage } from "./pages/documents";
import { EvidencePage } from "./pages/evidence";
import { HistoryPage } from "./pages/history";
import { LoginPage } from "./pages/login";
import { OverviewPage } from "./pages/overview";
import { ReviewActionsPage } from "./pages/review-actions";
import { ReviewsPage } from "./pages/reviews";
import { TestLabPage } from "./pages/test-lab";

export function CommercialWorkbench(dependencies: CommercialDependencies): React.ReactElement {
  return (
    <WorkbenchProvider {...dependencies}>
      <BrowserRouter>
        <ApplicationFrame>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/test-lab" element={<TestLabPage />} />
              <Route path="/cases/:caseId" element={<CaseWorkspace />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="evidence" element={<EvidencePage />} />
                <Route path="assistant" element={<AssistantPage />} />
                <Route path="review-actions" element={<ReviewActionsPage />} />
                <Route path="history" element={<HistoryPage />} />
              </Route>
            </Route>
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ApplicationFrame>
      </BrowserRouter>
    </WorkbenchProvider>
  );
}

function ProtectedRoutes(): React.ReactElement {
  const { session, loading, error } = useWorkbench();
  if (loading) return <PageLoading label="안전한 작업 환경을 준비하는 중입니다." />;
  if (error) return <PageError title="작업대를 시작할 수 없습니다." detail={error} />;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RootRedirect(): React.ReactElement {
  const { session, loading } = useWorkbench();
  if (loading) return <PageLoading label="작업대를 준비하는 중입니다." />;
  return <Navigate to={session ? "/reviews" : "/login"} replace />;
}

function NotFound(): React.ReactElement {
  return (
    <div className="page-state">
      <h1>요청한 화면을 찾을 수 없습니다.</h1>
      <p>심사 업무함에서 다시 시작해 주십시오.</p>
      <a className="commercial-button commercial-button--primary" href="/reviews">심사 업무함으로 이동</a>
    </div>
  );
}
