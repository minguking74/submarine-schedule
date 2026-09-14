import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import { useAuth } from '../auth.jsx';

const KPI_COLUMNS = [
  { key: 'year', label: '연도', type: 'number' },
  { key: 'memo', label: '메모', type: 'text' },
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const [fxRate, setFxRate] = useState(1380);
  const [savedMsg, setSavedMsg] = useState('');
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    Promise.all([api.get('/settings'), api.get('/kpis')])
      .then(([s, k]) => { setFxRate(s.fx_rate); setKpis(k); })
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function saveFxRate(e) {
    e.preventDefault();
    await api.put('/settings', { fx_rate: fxRate });
    setSavedMsg('저장되었습니다');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ 설정</h1>
          <div className="page-sub">환율 기준값과 연도별 KPI 메모를 관리합니다</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">₩/$ 기준환율</h3>
        <form className="settings-form" onSubmit={saveFxRate}>
          <label>
            기준환율 (KRW per USD)
            <input type="number" value={fxRate} disabled={!isAdmin} onChange={(e) => setFxRate(Number(e.target.value))} />
          </label>
          {isAdmin && <button className="btn-sm btn-primary" type="submit" style={{ width: 'fit-content' }}>저장</button>}
          {savedMsg && <span style={{ color: '#5ee6a0', fontSize: 12 }}>{savedMsg}</span>}
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">연도별 KPI 메모</h3>
        <DataTable
          readOnly={!isAdmin}
          columns={KPI_COLUMNS}
          rows={kpis}
          onCreate={async (v) => { await api.post('/kpis', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/kpis/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/kpis/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
