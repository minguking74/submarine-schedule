import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';

const COLUMNS = [
  { key: 'schedule', label: 'Schedule', type: 'text' },
  { key: 'seg_type', label: 'Type', type: 'select', options: ['S', 'L'] },
  { key: 'segment_id', label: 'Segment ID', type: 'text' },
  { key: 'if100g', label: '100G I/F (Gbps)', type: 'number' },
  { key: 'if400g', label: '400G I/F (Gbps)', type: 'number' },
  { key: 'unit_price', label: 'Unit Price / 100G ($)', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: ['설치완료', '구축중', '계획중', '취소'] },
  { key: 'complete_date', label: '완료일/예정일', type: 'text' },
  { key: 'note', label: '비고', type: 'text' },
];

export default function Lightup() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    api.get('/lightup').then(setRows).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  const live = rows.filter((r) => r.status !== '취소');
  const totalQty = live.reduce((s, r) => s + (r.if100g || 0) + (r.if400g || 0), 0);
  const totalCost = live.reduce((s, r) => s + (((r.if100g || 0) + (r.if400g || 0)) / 100) * (r.unit_price || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚡ Lightup Schedule</h1>
          <div className="page-sub">Lightup 일정별 구축 현황 (Status: 설치완료 / 구축중 / 계획중)</div>
        </div>
      </div>

      <div className="pill-row">
        <div className="pill">총 {rows.length}건 (취소 제외 {live.length}건)</div>
        <div className="pill">총 물량 {totalQty.toLocaleString()} Gbps</div>
        <div className="pill">총 예상비용 ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
      </div>

      <div className="card">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          onCreate={async (v) => { await api.post('/lightup', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/lightup/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/lightup/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
