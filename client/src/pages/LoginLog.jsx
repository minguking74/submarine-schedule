import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function LoginLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/login-log').then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔐 로그인 기록</h1>
          <div className="page-sub">누가 언제 로그인했는지 확인합니다 (관리자 전용)</div>
        </div>
      </div>
      <div className="card">
        <div className="log-list">
          {rows.length === 0 && <div className="empty-row">기록이 없습니다</div>}
          {rows.map((r) => (
            <div className="log-item" key={r.id}>
              <span className="log-time">{new Date(r.at).toLocaleString('ko-KR')}</span>
              <span>{r.name} · <span className={r.role === 'admin' ? 'badge-red' : ''}>{r.role}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
