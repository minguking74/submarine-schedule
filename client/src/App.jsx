import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CapacityDesign from './pages/CapacityDesign.jsx';
import Lightup from './pages/Lightup.jsx';
import Funnel from './pages/Funnel.jsx';
import Contracts from './pages/Contracts.jsx';
import Revenue from './pages/Revenue.jsx';
import InternalDemand from './pages/InternalDemand.jsx';
import LogPage from './pages/Log.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
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
        </Routes>
      </main>
    </div>
  );
}
