import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { api } from '../api.js';

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

function SegmentTable({ title, data }) {
  const rows = [...data.rows, data.total];
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <div className="data-table-wrap">
        <table className="plain-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Design</th>
              <th>Equip 100G</th>
              <th>Equip 400G</th>
              <th>구축중 100G</th>
              <th>구축중 400G</th>
              <th>Sold 100G</th>
              <th>Sold 400G</th>
              <th>Avail 100G</th>
              <th>Avail 400G</th>
              <th>Sold 합계</th>
              <th>Avail 합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.segment_id} className={r.segment_id === 'TOTAL' ? 'total-row' : ''}>
                <td>{r.segment_label}</td>
                <td>{fmt(r.design, 0)}</td>
                <td>{fmt(r.equip100, 0)}</td>
                <td>{fmt(r.equip400, 0)}</td>
                <td>{fmt(r.construct100, 0)}</td>
                <td>{fmt(r.construct400, 0)}</td>
                <td>{fmt(r.sold100, 0)}</td>
                <td>{fmt(r.sold400, 0)}</td>
                <td className={r.avail100 < 0 ? 'badge-red' : ''}>{fmt(r.avail100, 0)}</td>
                <td className={r.avail400 < 0 ? 'badge-red' : ''}>{fmt(r.avail400, 0)}</td>
                <td>{fmt(r.sold_total, 0)}</td>
                <td>{fmt(r.avail_total, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-box">불러오기 실패: {error}</div>;
  if (!data) return <div className="loading">불러오는 중...</div>;

  const chartData = data.segment_s.rows.map((r) => ({
    name: r.segment_label,
    Sold: r.sold_total,
    Available: r.avail_total,
  }));

  const revenueChartData = data.revenue_yearly.map((y) => ({
    year: y.year,
    'Lease 매출(억원)': Number(y.lease_revenue_eok.toFixed(2)),
    'IRU OTC(억원)': Number(y.iru_otc_revenue_eok.toFixed(2)),
    'IRU O&M(억원)': Number(y.iru_om_revenue_eok.toFixed(2)),
    'BW(Gbps)': y.contracted_bandwidth_gbps,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛰️ SJC2 Capacity Schedule Management</h1>
          <div className="page-sub">
            {data.current_kpi ? `${data.current_kpi.year}년 · ${data.current_kpi.memo || '메모 없음'}` : ''}
            {'  ·  ₩/$ 기준환율 '}{fmt(data.fx_rate, 0)}
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-tile">
          <div className="kpi-label">Active 계약</div>
          <div className="kpi-value">{data.headline.active_contracts_count}<span className="kpi-unit">건</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Active 총 BW</div>
          <div className="kpi-value">{fmt(data.headline.active_bandwidth_gbps, 0)}<span className="kpi-unit">Gbps</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Lease MRC</div>
          <div className="kpi-value">{fmt(data.headline.lease_mrc_eok)}<span className="kpi-unit">억원/월</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">누적 매출</div>
          <div className="kpi-value">{fmt(data.headline.cumulative_revenue_eok, 0)}<span className="kpi-unit">억원</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Segment S 사용률 (Design 대비 Sold)</div>
          <div className="kpi-value">{data.segment_s_utilization_pct}<span className="kpi-unit">%</span></div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">🌊 Segment S — Sold vs Available (Gbps)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#263148" />
            <XAxis dataKey="name" stroke="#93a1bd" fontSize={12} />
            <YAxis stroke="#93a1bd" fontSize={12} />
            <Tooltip contentStyle={{ background: '#172033', border: '1px solid #263148', color: '#e6ecf5' }} />
            <Legend />
            <Bar dataKey="Sold" stackId="a" fill="#3aa0ff" />
            <Bar dataKey="Available" stackId="a" fill="#5ee6c2" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SegmentTable title="🌊 Segment S 상세 (Gbps)" data={data.segment_s} />
      <SegmentTable title="🛣️ Segment L 상세 (Gbps)" data={data.segment_l} />

      <div className="grid-3">
        <div className="card">
          <h3 className="card-title">💰 매출 요약</h3>
          <table className="plain-table">
            <tbody>
              <tr><td>Lease MRC</td><td>{fmt(data.revenue_summary.lease_mrc_eok)} 억원/월</td></tr>
              <tr><td>Lease ARR</td><td>{fmt(data.revenue_summary.lease_arr_eok)} 억원/년</td></tr>
              <tr><td>IRU OTC</td><td>{fmt(data.revenue_summary.iru_otc_eok)} 억원</td></tr>
              <tr><td>IRU 연O&M</td><td>{fmt(data.revenue_summary.iru_om_eok)} 억원</td></tr>
              <tr><td>누적매출</td><td>{fmt(data.revenue_summary.cumulative_revenue_eok, 0)} 억원</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="card-title">🔽 Funnel 파이프라인</h3>
          <table className="plain-table">
            <thead><tr><th>Stage</th><th>건수</th><th>BW(Gbps)</th></tr></thead>
            <tbody>
              {data.funnel_summary.map((f) => (
                <tr key={f.stage}><td>{f.stage}</td><td>{f.count}</td><td>{fmt(f.bandwidth_gbps, 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="card-title">⚡ Lightup 현황</h3>
          <table className="plain-table">
            <thead><tr><th>Status</th><th>Qty(Gbps)</th><th>Est. Cost($)</th></tr></thead>
            <tbody>
              {data.lightup_summary.map((l) => (
                <tr key={l.status}><td>{l.status}</td><td>{fmt(l.qty_gbps, 0)}</td><td>{fmt(l.est_cost_usd, 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">📅 연도별 매출(억원) &amp; 계약 Bandwidth(Gbps)</h3>
        <div className="page-sub" style={{ marginBottom: 10 }}>
          매출은 회계기준 월별 비례인식(Revenue_Monthly 방식), BW는 그 해 신규 계약 기준
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#263148" />
            <XAxis dataKey="year" stroke="#93a1bd" fontSize={12} />
            <YAxis stroke="#93a1bd" fontSize={12} />
            <Tooltip contentStyle={{ background: '#172033', border: '1px solid #263148', color: '#e6ecf5' }} />
            <Legend />
            <Bar dataKey="Lease 매출(억원)" stackId="rev" fill="#3aa0ff" />
            <Bar dataKey="IRU OTC(억원)" stackId="rev" fill="#5ee6c2" />
            <Bar dataKey="IRU O&M(억원)" stackId="rev" fill="#ffb84d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
