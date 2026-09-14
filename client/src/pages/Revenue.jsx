import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

export default function Revenue() {
  const [yearly, setYearly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    Promise.all([
      api.get('/revenue/yearly?from=2023&to=2030'),
      api.get(`/revenue/monthly?from=${year}&to=${year}`),
    ]).then(([y, m]) => { setYearly(y); setMonthly(m); }).finally(() => setLoading(false));
  }, [year]);

  const monthlyByMonth = useMemo(() => {
    const buckets = {};
    for (const r of monthly) {
      const key = r.year_month;
      if (!buckets[key]) buckets[key] = { year_month: key, lease: 0, iru_otc: 0, iru_om: 0 };
      buckets[key].lease += r.lease_revenue_usd;
      buckets[key].iru_otc += r.iru_otc_revenue_usd;
      buckets[key].iru_om += r.iru_om_revenue_usd;
    }
    return Object.values(buckets).sort((a, b) => a.year_month.localeCompare(b.year_month));
  }, [monthly]);

  if (loading && yearly.length === 0) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 수익성 / Revenue</h1>
          <div className="page-sub">계약별 매출은 시작일~만료일 사이 월별로 비례 인식되어 계산됩니다</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">연도별 매출 (억원)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={yearly.map((y) => ({
            year: y.year,
            'Lease': Number(y.lease_revenue_eok.toFixed(2)),
            'IRU OTC': Number(y.iru_otc_revenue_eok.toFixed(2)),
            'IRU O&M': Number(y.iru_om_revenue_eok.toFixed(2)),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#263148" />
            <XAxis dataKey="year" stroke="#93a1bd" fontSize={12} />
            <YAxis stroke="#93a1bd" fontSize={12} />
            <Tooltip contentStyle={{ background: '#172033', border: '1px solid #263148', color: '#e6ecf5' }} />
            <Legend />
            <Bar dataKey="Lease" stackId="rev" fill="#3aa0ff" />
            <Bar dataKey="IRU OTC" stackId="rev" fill="#5ee6c2" />
            <Bar dataKey="IRU O&M" stackId="rev" fill="#ffb84d" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="card-title">연도별 요약 테이블</h3>
        <table className="plain-table">
          <thead>
            <tr>
              <th>연도</th><th>Lease 매출</th><th>IRU 매출</th><th>IRU O&M 매출</th><th>총 매출</th><th>계약 Gbps</th><th>신규 계약 건수</th>
            </tr>
          </thead>
          <tbody>
            {yearly.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{fmt(y.lease_revenue_eok)}</td>
                <td>{fmt(y.iru_otc_revenue_eok)}</td>
                <td>{fmt(y.iru_om_revenue_eok)}</td>
                <td>{fmt(y.total_revenue_eok)}</td>
                <td>{fmt(y.contracted_bandwidth_gbps, 0)}</td>
                <td>{y.new_contract_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ margin: 0 }}>월별 매출 상세 (Revenue_Monthly)</h3>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ background: '#172033', color: '#e6ecf5', border: '1px solid #263148', borderRadius: 8, padding: '6px 10px', width: 100 }}
          />
        </div>
        <table className="plain-table" style={{ marginTop: 14 }}>
          <thead>
            <tr><th>연월</th><th>Lease 매출($)</th><th>IRU OTC 매출($)</th><th>IRU O&M 매출($)</th><th>합계($)</th></tr>
          </thead>
          <tbody>
            {monthlyByMonth.length === 0 && (
              <tr><td colSpan={5} className="empty-row">해당 연도의 매출 데이터가 없습니다</td></tr>
            )}
            {monthlyByMonth.map((m) => (
              <tr key={m.year_month}>
                <td>{m.year_month}</td>
                <td>{fmt(m.lease, 0)}</td>
                <td>{fmt(m.iru_otc, 0)}</td>
                <td>{fmt(m.iru_om, 0)}</td>
                <td>{fmt(m.lease + m.iru_otc + m.iru_om, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
