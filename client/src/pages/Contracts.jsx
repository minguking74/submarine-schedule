import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';

function money(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const STATUS_OPTIONS = ['Active', 'Expired', 'Terminated', '미정'];

function statusBadge(status) {
  const cls = status === 'Active' ? 'badge-green'
    : status === 'Expired' ? 'badge-gray'
    : status === 'Terminated' ? 'badge-red'
    : 'badge-yellow';
  return <span className={`badge ${cls}`}>{status || '미정'}</span>;
}

const COLUMNS = [
  { key: 'no', label: 'No.', type: 'text', width: 60 },
  { key: 'customer', label: '고객명', type: 'text' },
  { key: 'contract_type', label: '계약방식', type: 'select', options: ['Lease', 'IRU'] },
  { key: 'segment_s', label: 'Segment S', type: 'text' },
  { key: 'segment_l', label: 'Segment L', type: 'text' },
  { key: 'a_end', label: 'A End', type: 'text' },
  { key: 'z_end', label: 'Z End', type: 'text' },
  { key: 'if100g', label: '100G(Gbps)', type: 'number' },
  { key: 'if400g', label: '400G(Gbps)', type: 'number' },
  { key: 'bandwidth', label: 'BW(Gbps)', readOnly: true },
  { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'KRW'] },
  { key: 'mrc', label: 'MRC', type: 'number' },
  { key: 'otc', label: 'OTC', type: 'number' },
  { key: 'om_annual', label: '연O&M', type: 'number' },
  { key: 'contract_year', label: '계약연도', type: 'number' },
  { key: 'duration_months', label: '기간(월)', type: 'number' },
  { key: 'start_date', label: '시작일', type: 'date' },
  { key: 'end_date', label: '만료일', readOnly: true },
  { key: 'total_revenue_usd', label: '총매출($)', readOnly: true, render: money },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, render: statusBadge },
  { key: 'cc_flag', label: 'CC여부', type: 'text' },
  { key: 'am', label: 'AM', type: 'text' },
];

export default function Contracts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  function reload() {
    api.get('/contracts').then(setRows).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus !== 'ALL' && (r.status || '미정') !== filterStatus) return false;
      if (search && !`${r.customer} ${r.segment_s} ${r.segment_l} ${r.a_end} ${r.z_end}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterStatus, search]);

  if (loading) return <div className="loading">불러오는 중...</div>;

  const activeCount = rows.filter((r) => r.status === 'Active').length;
  const activeBw = rows.filter((r) => r.status === 'Active').reduce((s, r) => s + r.bandwidth, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Contracts</h1>
          <div className="page-sub">체결된 계약 목록 (BW/만료일/총매출은 서버에서 자동 계산됩니다)</div>
        </div>
      </div>

      <div className="pill-row">
        <div className="pill">전체 {rows.length}건</div>
        <div className="pill">Active {activeCount}건</div>
        <div className="pill">Active BW {activeBw.toLocaleString()} Gbps</div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ background: '#172033', color: '#e6ecf5', border: '1px solid #263148', borderRadius: 8, padding: '6px 10px' }}>
          <option value="ALL">전체 Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="고객/구간 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: '#172033', color: '#e6ecf5', border: '1px solid #263148', borderRadius: 8, padding: '6px 10px', minWidth: 180 }}
        />
      </div>

      <div className="card">
        <DataTable
          columns={COLUMNS}
          rows={filtered}
          onCreate={async (v) => { await api.post('/contracts', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/contracts/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/contracts/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
