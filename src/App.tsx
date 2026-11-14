import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DataAccessPage } from './features/auth/DataAccessPage';
import { SignInPage } from './features/auth/SignInPage';
import { FramePage } from './features/frame/FramePage';
import { ContactSupportPage, HelpPage, ReportProblemPage } from './features/help/HelpPage';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { DecisionRecordPage } from './features/log/DecisionRecordPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { WorkspacePage } from './features/workspace/WorkspacePage';
import { useStore } from './store/store';

function RequireAuth() {
  const { state } = useStore();
  const location = useLocation();
  if (!state.user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// The old one-page-per-step URLs now open the matching workspace section.
function ToWorkspace({ section }: { section: string }) {
  const { id } = useParams();
  return <Navigate to={`/decisions/${id}/work#${section}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      {/* Public, so it can be read before signing in. */}
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/onboarding" element={<DataAccessPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/decisions/new" element={<FramePage />} />
          <Route path="/decisions/:id/work" element={<WorkspacePage />} />
          <Route path="/decisions/:id/frame" element={<ToWorkspace section="frame" />} />
          <Route path="/decisions/:id/brief" element={<ToWorkspace section="evidence" />} />
          <Route path="/decisions/:id/options" element={<ToWorkspace section="options" />} />
          <Route path="/decisions/:id" element={<DecisionRecordPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/help/contact" element={<ContactSupportPage />} />
          <Route path="/help/report" element={<ReportProblemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
