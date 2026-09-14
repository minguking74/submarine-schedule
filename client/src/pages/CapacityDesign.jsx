import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';

const COLUMNS = [
  { key: 'seg_type', label: 'Type', type: 'select', options: ['S', 'L'] },
  { key: 'segment_id', label: 'Segment ID', type: 'text' },
  { key: 'segment_label', label: 'Segment Label', type: 'text' },
  { key: 'design_capacity_gbps', label: 'Design Capacity (Gbps)', type: 'number' },
  { key: 'sort_order', label: '정렬순서', type: 'number' },
];

const PHASE_COLUMNS = [
  { key: 'segment_label', label: '구간', type: 'text' },
  { key: 'current_tbps', label: '현재 (Tbps)', type: 'number' },
  { key: 'phase1_tbps', label: '1단계', type: 'number' },
  { key: 'phase2_tbps', label: '2단계', type: 'number' },
  { key: 'phase3_tbps', label: '3단계', type: 'number' },
  { key: 'phase4_tbps', label: '4단계', type: 'number' },
];

export default function CapacityDesign() {
  const [rows, setRows] = useState([]);
  const [phaseRows, setPhaseRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    Promise.all([api.get('/capacity-design'), api.get('/capacity-phase')])
      .then(([a, b]) => { setRows(a); setPhaseRows(b); })
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🌊 Capacity Design</h1>
          <div className="page-sub">Segment S/L 별 Design 용량 (Excel 'Capacity_Design' 시트에 대응)</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Segment 설계 용량</h3>
        <DataTable
          columns={COLUMNS}
          rows={rows}
          onCreate={async (v) => { await api.post('/capacity-design', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/capacity-design/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/capacity-design/${id}`); reload(); }}
        />
      </div>

      <div className="card">
        <h3 className="card-title">SJC2 한-싱 추가 가능 용량 (Tbps) — 단계별 계획</h3>
        <DataTable
          columns={PHASE_COLUMNS}
          rows={phaseRows}
          onCreate={async (v) => { await api.post('/capacity-phase', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/capacity-phase/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/capacity-phase/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
