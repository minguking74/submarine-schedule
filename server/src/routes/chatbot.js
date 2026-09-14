import { Router } from 'express';
import { buildDashboard } from '../dashboard.js';
import { askLlm } from '../llm.js';

const router = Router();

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toFixed(digits);
}

function buildContext(dash) {
  const lines = [];
  lines.push(`[SJC2 Capacity Schedule 현황 — ${new Date().toISOString().slice(0, 10)} 기준]`);
  lines.push(`기준환율: ${fmt(dash.fx_rate, 0)} KRW/USD`);
  if (dash.current_kpi) lines.push(`${dash.current_kpi.year}년 KPI 메모: ${dash.current_kpi.memo || '없음'}`);
  lines.push('');
  lines.push('--- 헤드라인 ---');
  lines.push(`Active 계약 수: ${dash.headline.active_contracts_count}건`);
  lines.push(`Active 총 대역폭: ${fmt(dash.headline.active_bandwidth_gbps, 0)} Gbps`);
  lines.push(`Lease MRC: ${fmt(dash.headline.lease_mrc_eok)} 억원/월`);
  lines.push(`누적 매출: ${fmt(dash.headline.cumulative_revenue_eok, 0)} 억원`);
  lines.push(`Segment S 사용률: ${dash.segment_s_utilization_pct}%`);
  lines.push('');
  lines.push('--- Segment S 상세 (Gbps) ---');
  for (const r of [...dash.segment_s.rows, dash.segment_s.total]) {
    lines.push(`${r.segment_label}: Design ${fmt(r.design, 0)}, Sold ${fmt(r.sold_total, 0)}, Available ${fmt(r.avail_total, 0)}`);
  }
  lines.push('');
  lines.push('--- Segment L 상세 (Gbps) ---');
  for (const r of [...dash.segment_l.rows, dash.segment_l.total]) {
    lines.push(`${r.segment_label}: Design ${fmt(r.design, 0)}, Sold ${fmt((r.sold100 || 0) + (r.sold400 || 0), 0)}, Available ${fmt((r.avail100 || 0) + (r.avail400 || 0), 0)}`);
  }
  lines.push('');
  lines.push('--- 매출 요약 ---');
  lines.push(`Lease MRC ${fmt(dash.revenue_summary.lease_mrc_eok)} 억원/월, Lease ARR ${fmt(dash.revenue_summary.lease_arr_eok)} 억원/년`);
  lines.push(`IRU OTC ${fmt(dash.revenue_summary.iru_otc_eok)} 억원, IRU 연O&M ${fmt(dash.revenue_summary.iru_om_eok)} 억원`);
  lines.push('');
  lines.push('--- Funnel 파이프라인 ---');
  for (const f of dash.funnel_summary) lines.push(`${f.stage}: ${f.count}건, ${fmt(f.bandwidth_gbps, 0)} Gbps`);
  lines.push('');
  lines.push('--- Lightup 현황 ---');
  for (const l of dash.lightup_summary) lines.push(`${l.status}: ${fmt(l.qty_gbps, 0)} Gbps, 예상비용 $${fmt(l.est_cost_usd, 0)}`);
  lines.push('');
  lines.push('--- 연도별 매출/계약 BW ---');
  for (const y of dash.revenue_yearly) {
    lines.push(`${y.year}년: Lease 매출 ${fmt(y.lease_revenue_eok)}억, IRU OTC ${fmt(y.iru_otc_revenue_eok)}억, IRU O&M ${fmt(y.iru_om_revenue_eok)}억, 신규계약 BW ${fmt(y.contracted_bandwidth_gbps, 0)} Gbps`);
  }
  return lines.join('\n');
}

const SYSTEM_PROMPT = `당신은 SJC2 해저케이블 Capacity Schedule 대시보드의 사내 챗봇입니다.
아래에 주어지는 내부 데이터 스냅샷만 근거로 사용자 질문에 답하세요.
데이터에 없는 내용은 추측하지 말고 모른다고 답하세요. 숫자에는 단위를 함께 표기하세요.
답변은 한국어로, 간결하게 작성하세요.`;

router.post('/', async (req, res) => {
  const userMessage = String(req.body.message || '').trim();
  if (!userMessage) return res.status(400).json({ error: '질문을 입력해 주세요' });
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];

  const dash = await buildDashboard();
  const context = buildContext(dash);

  const result = await askLlm({
    system: `${SYSTEM_PROMPT}\n\n${context}`,
    messages: [...history, { role: 'user', content: userMessage }],
  });

  res.json(result);
});

export default router;
