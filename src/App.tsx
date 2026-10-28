import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataAccessPage } from './features/auth/DataAccessPage';
import { SignInPage } from './features/auth/SignInPage';
import { BriefPage } from './features/brief/BriefPage';
import { FramePage } from './features/frame/FramePage';
import { HelpPage } from './features/help/HelpPage';
import { DecisionRecordPage } from './features/log/DecisionRecordPage';
import { DecisionsPage } from './features/log/DecisionsPage';
import { OptionsPage } from './features/options/OptionsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { useStore } from './store/store';

function RequireAuth() {
  const { state } = useStore();
  const location = useLocation();
  if (!state.user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/onboarding" element={<DataAccessPage />} />
          <Route path="/" element={<DecisionsPage />} />
          <Route path="/decisions/new" element={<FramePage />} />
          <Route path="/decisions/:id/frame" element={<FramePage />} />
          <Route path="/decisions/:id/brief" element={<BriefPage />} />
          <Route path="/decisions/:id/options" element={<OptionsPage />} />
          <Route path="/decisions/:id" element={<DecisionRecordPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
