import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function LogPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/log?limit=300').then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🕘 변경 이력</h1>
          <div className="page-sub">모든 데이터 추가/수정/삭제가 자동으로 기록됩니다 (Excel 'Log' 시트 대응)</div>
        </div>
      </div>
      <div className="card">
        <div className="log-list">
          {rows.length === 0 && <div className="empty-row">기록이 없습니다</div>}
          {rows.map((r) => (
            <div className="log-item" key={r.id}>
              <span className="log-time">{r.at}</span>
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
