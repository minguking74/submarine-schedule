import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Sidebar from './components/Sidebar.jsx';
import Chatbot from './components/Chatbot.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CapacityDesign from './pages/CapacityDesign.jsx';
import Lightup from './pages/Lightup.jsx';
import Funnel from './pages/Funnel.jsx';
import Contracts from './pages/Contracts.jsx';
import Revenue from './pages/Revenue.jsx';
import InternalDemand from './pages/InternalDemand.jsx';
import LogPage from './pages/Log.jsx';
import Settings from './pages/Settings.jsx';
import Resources from './pages/Resources.jsx';
import LoginLog from './pages/LoginLog.jsx';
import CableOverview from './pages/CableOverview.jsx';

function AppShell() {
  const { token, isAdmin } = useAuth();

  if (!token) return <Login />;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/capacity" element={<CapacityDesign />} />
          <Route path="/lightup" element={<Lightup />} />
          <Route path="/funnel" element={<Funnel />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/demand" element={<InternalDemand />} />
          <Route path="/log" element={<LogPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/cables/e2a" element={<CableOverview cableKey="e2a" />} />
          <Route path="/cables/pae" element={<CableOverview cableKey="pae" />} />
          {isAdmin && <Route path="/login-log" element={<LoginLog />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Chatbot />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
