import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: '📊', end: true },
  { to: '/capacity', label: 'Capacity Design', icon: '🌊' },
  { to: '/lightup', label: 'Lightup Schedule', icon: '⚡' },
  { to: '/funnel', label: 'Funnel (Pipeline)', icon: '🔽' },
  { to: '/contracts', label: 'Contracts', icon: '📄' },
  { to: '/revenue', label: '수익성 / Revenue', icon: '💰' },
  { to: '/demand', label: '내부수요 (Gap)', icon: '🧭' },
  { to: '/log', label: '변경 이력', icon: '🕘' },
  { to: '/settings', label: '설정', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🛰️</span>
        <div>
          <div className="brand-title">SJC2</div>
          <div className="brand-sub">Capacity Schedule</div>
        </div>
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
      </nav>
    </aside>
  );
}
