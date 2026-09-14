import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: '📊', end: true },
  { to: '/capacity', label: 'Capacity Design', icon: '🌊' },
  { to: '/lightup', label: 'Lightup Schedule', icon: '⚡' },
  { to: '/funnel', label: 'Funnel (Pipeline)', icon: '🔽' },
  { to: '/contracts', label: 'Contracts', icon: '📄' },
  { to: '/revenue', label: '수익성 / Revenue', icon: '💰' },
  { to: '/demand', label: '내부수요 (Gap)', icon: '🧭' },
  { to: '/log', label: '변경 이력', icon: '🕘' },
  { to: '/resources', label: '외부 자료', icon: '🔗' },
  { to: '/settings', label: '설정', icon: '⚙️' },
];

const CABLES = [
  { key: 'sjc2', label: 'SJC2', to: '/' },
  { key: 'e2a', label: 'E2A', to: '/cables/e2a' },
  { key: 'pae', label: 'PAE', to: '/cables/pae' },
];

export default function Sidebar() {
  const { name, role, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const activeCable = location.pathname.startsWith('/cables/e2a') ? 'e2a'
    : location.pathname.startsWith('/cables/pae') ? 'pae'
    : 'sjc2';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🛰️</span>
        <div>
          <div className="brand-title">SJC2</div>
          <div className="brand-sub">Capacity Schedule</div>
        </div>
      </div>

      <div className="cable-switcher">
        {CABLES.map((c) => (
          <button
            key={c.key}
            className={'cable-pill' + (activeCable === c.key ? ' active' : '')}
            onClick={() => navigate(c.to)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/login-log" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <span className="nav-icon">🔐</span>
            로그인 기록
          </NavLink>
        )}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{name}</div>
          <div className="sidebar-user-role">{role === 'admin' ? '관리자' : '뷰어'}</div>
        </div>
        <button className="btn-sm" onClick={logout}>로그아웃</button>
      </div>
    </aside>
  );
}
