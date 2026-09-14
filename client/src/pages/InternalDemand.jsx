import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import { useAuth } from '../auth.jsx';

const S_COLUMNS = [
  { key: 'dls_code', label: 'DLS', type: 'text' },
  { key: 'segment_label', label: 'Segment', type: 'text' },
  { key: 'h1', label: 'H1', type: 'number' },
  { key: 'h2', label: 'H2', type: 'number' },
  { key: 'h3', label: 'H3', type: 'number' },
  { key: 'h4', label: 'H4', type: 'number' },
  { key: 'h5', label: 'H5', type: 'number' },
  { key: 'h6', label: 'H6', type: 'number' },
];

const L_COLUMNS = [
  { key: 'pop', label: 'PoP', type: 'text' },
  { key: 'segment_label', label: 'Segment', type: 'text' },
  { key: 'h1', label: 'H1', type: 'number' },
  { key: 'h2', label: 'H2', type: 'number' },
  { key: 'h3', label: 'H3', type: 'number' },
  { key: 'h4', label: 'H4', type: 'number' },
  { key: 'h5', label: 'H5', type: 'number' },
];

export default function InternalDemand() {
  const { isAdmin } = useAuth();
  const [sRows, setSRows] = useState([]);
  const [lRows, setLRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    Promise.all([api.get('/internal-demand-s'), api.get('/internal-demand-l')])
      .then(([s, l]) => { setSRows(s); setLRows(l); })
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧭 내부수요 (Gap)</h1>
          <div className="page-sub">IP백본 내부수요 반기별 전망 — Segment S / L. H1~H6은 반기 마일스톤(순서대로)을 의미합니다.</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">IP백본 Segment S 내부수요 (Tbps)</h3>
        <DataTable
          readOnly={!isAdmin}
          columns={S_COLUMNS}
          rows={sRows}
          onCreate={async (v) => { await api.post('/internal-demand-s', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/internal-demand-s/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/internal-demand-s/${id}`); reload(); }}
        />
      </div>

      <div className="card">
        <h3 className="card-title">IP백본 Segment L 내부수요 (Tbps)</h3>
        <DataTable
          readOnly={!isAdmin}
          columns={L_COLUMNS}
          rows={lRows}
          onCreate={async (v) => { await api.post('/internal-demand-l', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/internal-demand-l/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/internal-demand-l/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
