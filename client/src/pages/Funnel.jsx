import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';

const COLUMNS = [
  { key: 'no', label: 'No.', type: 'number' },
  { key: 'customer', label: '고객명', type: 'text' },
  { key: 'a_end', label: 'A End', type: 'text' },
  { key: 'z_end', label: 'Z End', type: 'text' },
  { key: 'if100g', label: '100G I/F (Gbps)', type: 'number' },
  { key: 'if400g', label: '400G I/F (Gbps)', type: 'number' },
  { key: 'stage', label: 'Stage', type: 'select', options: ['Prospect', 'Negotiation', 'Signed', 'Active'] },
  { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
  { key: 'target_date', label: '목표일', type: 'date' },
  { key: 'note', label: '비고', type: 'text' },
];

export default function Funnel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    api.get('/funnel').then(setRows).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔽 Funnel (영업 파이프라인)</h1>
          <div className="page-sub">Stage: Prospect → Negotiation → Signed → Active</div>
        </div>
      </div>
      <div className="card">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          onCreate={async (v) => { await api.post('/funnel', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/funnel/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/funnel/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
