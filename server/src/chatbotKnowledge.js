/**
 * Internal-data knowledge for the chatbot. Everything the bot may say comes from one
 * snapshot of this app's own tables (loadSnapshot), either through the rule-based
 * answerer below (no LLM needed) or as the only context handed to an LLM.
 */
import { db } from './db.js';
import { buildDashboard } from './dashboard.js';
import { listEnrichedContracts } from './calc.js';

export async function loadSnapshot() {
  const all = (sql) => db.prepare(sql).all();
  const [dash, contracts, funnel, lightup, phases, demandS, demandL, kpis, cables] = await Promise.all([
    buildDashboard(),
    listEnrichedContracts(),
    all(`SELECT * FROM funnel ORDER BY id`),
    all(`SELECT * FROM lightup_schedule ORDER BY id`),
    all(`SELECT * FROM capacity_phase ORDER BY sort_order, id`),
    all(`SELECT * FROM internal_demand_s ORDER BY sort_order, id`),
    all(`SELECT * FROM internal_demand_l ORDER BY sort_order, id`),
    all(`SELECT * FROM kpis ORDER BY year`),
    all(`SELECT * FROM cables ORDER BY sort_order, id`).catch(() => []),
  ]);
  return {
    asOf: new Date().toISOString().slice(0, 10),
    dash,
    // Template rows from the original workbook have no customer; they carry no information.
    contracts: contracts.filter((c) => String(c.customer || '').trim()),
    funnel,
    lightup,
    phases,
    demandS,
    demandL,
    kpis,
    cables,
  };
}

// ---------------------------------------------------------------- formatting

function n(v, digits = 0) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '-';
  return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
const gbps = (v) => `${Number.isInteger(Number(v)) ? n(v) : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 3 })} Gbps`;
const eok = (v) => `${n(v, 1)}억원`;
const usd = (v) => `$${n(v)}`;

function contractLine(c) {
  const seg = [c.segment_s, c.segment_l].filter(Boolean).join(' / ') || '-';
  const period = c.start_date ? `${c.start_date} ~ ${c.end_date || '?'}` : '기간 미정';
  const money = c.contract_type === 'IRU'
    ? `OTC ${usd(c.otc_usd)}, 연O&M ${usd(c.om_usd)}`
    : `MRC ${usd(c.mrc_usd)}/월`;
  return `• [${c.no || '-'}] ${c.customer} · ${c.contract_type} · ${seg} · ${gbps(c.bandwidth)} · ${period} · ${money} · ${c.status}`;
}

// ---------------------------------------------------------------- entity matching

const squash = (s) => String(s || '').toLowerCase().replace(/[\s\-_()·→>]/g, '');

const SEGMENT_ALIASES = {
  'KR-TY': ['krty', '한일ty', '한일도쿄', '도쿄', 'tokyo', '치쿠라', '한일'],
  'KR-OS': ['kros', '한일os', '한일오사카', '오사카', 'osaka', '시마', '한일'],
  'KR-HK': ['krhk', '한홍', '한국홍콩', '한홍콩'],
  'KR-SG': ['krsg', '한싱', '한국싱가포르', '한국싱가폴', '한싱가폴', '한싱가포르'],
  'JP-HK': ['jphk', '일홍', '일본홍콩', '일ty홍'],
  'JP-SG': ['jpsg', '일싱', '일본싱가포르', '일ty싱'],
  'HK-SG': ['hksg', '홍싱', '홍콩싱가포르', '홍싱가폴'],
  'CLS-GS': ['clsgs', 'globalswitch', '글로벌스위치'],
  'CLS-SG3': ['clssg3', 'sg3', 'equinix', '에퀴닉스'],
  'CLS-Mega-i': ['clsmegai', 'megai', '메가아이'],
};

function matchSegments(q) {
  const sq = squash(q);
  return Object.entries(SEGMENT_ALIASES)
    .filter(([id, aliases]) => sq.includes(squash(id)) || aliases.some((a) => sq.includes(a)))
    .map(([id]) => id);
}

function matchCustomers(q, snap) {
  const sq = squash(q);
  const names = [...new Set([...snap.contracts, ...snap.funnel].map((r) => String(r.customer || '').trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  const hits = [];
  for (const name of names) {
    const key = squash(name);
    if (key.length >= 2 && sq.includes(key) && !hits.some((h) => squash(h).includes(key))) hits.push(name);
  }
  return hits;
}

const has = (q, words) => words.some((w) => q.includes(w));

// ---------------------------------------------------------------- answer sections

function segmentRows(snap) {
  return [...snap.dash.segment_s.rows.map((r) => ({ ...r, type: 'S' })),
    ...snap.dash.segment_l.rows.map((r) => ({
      ...r,
      type: 'L',
      sold_total: (r.sold100 || 0) + (r.sold400 || 0),
      avail_total: (r.avail100 || 0) + (r.avail400 || 0),
    }))];
}

function segmentDetail(snap, ids) {
  const rows = segmentRows(snap).filter((r) => ids.includes(r.segment_id));
  const lines = rows.map((r) => {
    const parts = [
      `설계 ${gbps(r.design)}`,
      `설치완료 ${gbps((r.equip100 || 0) + (r.equip400 || 0))}`,
      `구축중 ${gbps((r.construct100 || 0) + (r.construct400 || 0))}`,
      `판매(Active) ${gbps(r.sold_total)}`,
      `가용 ${gbps(r.avail_total)}`,
    ];
    if (r.buildable_remaining !== null && r.buildable_remaining !== undefined) parts.push(`추가 증설가능 ${gbps(r.buildable_remaining)}`);
    const contracts = snap.contracts.filter((c) => c.status === 'Active' && (c.segment_s === r.segment_id
      || (r.type === 'L' && squash(c.segment_l).includes(squash(r.segment_id.replace('CLS-', ''))))));
    return `• ${r.segment_label} (${r.segment_id}, Segment ${r.type}): ${parts.join(', ')} — Active 계약 ${contracts.length}건`;
  });
  return { source: 'Dashboard · Segment 상세', text: `[Segment 용량]\n${lines.join('\n')}` };
}

function capacitySummary(snap) {
  const { dash } = snap;
  const s = dash.segment_s.total;
  const l = dash.segment_l.total;
  const ranked = [...dash.segment_s.rows].sort((a, b) => b.avail_total - a.avail_total).slice(0, 3);
  return {
    source: 'Dashboard · Capacity',
    text: [
      '[용량 현황]',
      `• Segment S 합계: 설계 ${gbps(s.design)}, 판매 ${gbps(s.sold_total)}, 가용 ${gbps(s.avail_total)} (사용률 ${dash.segment_s_utilization_pct}%)`,
      `• Segment L 합계: 설계 ${gbps(l.design)}, 판매 ${gbps(l.sold100 + l.sold400)}, 가용 ${gbps(l.avail100 + l.avail400)}`,
      `• 가용 용량 상위 Segment S: ${ranked.map((r) => `${r.segment_label} ${gbps(r.avail_total)}`).join(', ')}`,
    ].join('\n'),
  };
}

function contractsSection(snap, q, { segments, type }) {
  let rows = snap.contracts;
  if (type) rows = rows.filter((c) => c.contract_type === type);
  if (segments.length) {
    rows = rows.filter((c) => segments.includes(c.segment_s)
      || segments.some((id) => id.startsWith('CLS-') && squash(c.segment_l).includes(squash(id.replace('CLS-', '')))));
  }
  const active = rows.filter((c) => c.status === 'Active');
  const scope = [type, segments.join(', ')].filter(Boolean).join(' · ');
  const title = `[계약${scope ? ` (${scope})` : ''}]`;

  if (has(q, ['만료', '갱신', '종료', 'expire', 'renew', '끝나'])) {
    const today = snap.asOf;
    const upcoming = active.filter((c) => c.end_date && c.end_date >= today)
      .sort((a, b) => a.end_date.localeCompare(b.end_date)).slice(0, 10);
    return {
      source: 'Contracts',
      text: `${title}\n만료 예정 Active 계약 (가까운 순, 최대 10건):\n${upcoming.map(contractLine).join('\n') || '• 해당 계약이 없습니다.'}`,
    };
  }

  const byCustomer = new Map();
  for (const c of active) byCustomer.set(c.customer, (byCustomer.get(c.customer) || 0) + c.bandwidth);
  const top = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lines = [
    title,
    `• Active ${active.length}건 (Lease ${active.filter((c) => c.contract_type === 'Lease').length}, IRU ${active.filter((c) => c.contract_type === 'IRU').length}), 총 ${gbps(active.reduce((s, c) => s + c.bandwidth, 0))}`,
    `• 전체 등록 계약 ${rows.length}건 (Active 외 ${rows.length - active.length}건)`,
  ];
  if (top.length) lines.push(`• 대역폭 상위 고객: ${top.map(([name, bw]) => `${name} ${gbps(bw)}`).join(', ')}`);
  if (segments.length || type) lines.push(...active.slice(0, 15).map(contractLine));
  return { source: 'Contracts', text: lines.join('\n') };
}

function customerSection(snap, names) {
  const blocks = names.map((name) => {
    const cs = snap.contracts.filter((c) => c.customer === name);
    const fs = snap.funnel.filter((f) => String(f.customer || '').trim() === name);
    const lines = [`[고객: ${name}]`];
    if (cs.length) {
      const active = cs.filter((c) => c.status === 'Active');
      lines.push(`• 계약 ${cs.length}건 (Active ${active.length}건, Active 대역폭 ${gbps(active.reduce((s, c) => s + c.bandwidth, 0))})`);
      lines.push(...cs.slice(0, 15).map(contractLine));
    }
    if (fs.length) lines.push(...fs.map((f) => `• Funnel: ${f.a_end || '?'}→${f.z_end || '?'} · ${gbps((f.if100g || 0) + (f.if400g || 0))} · ${f.stage} · 목표 ${f.target_date || '-'}${f.note ? ` · ${f.note}` : ''}`));
    return lines.join('\n');
  });
  return { source: 'Contracts · Funnel', text: blocks.join('\n\n') };
}

function revenueSection(snap, q) {
  const { dash } = snap;
  const years = (q.match(/20\d\d/g) || []).map(Number);
  const yearly = years.length ? dash.revenue_yearly.filter((y) => years.includes(y.year)) : dash.revenue_yearly;
  const lines = ['[매출]'];
  if (!years.length) {
    lines.push(`• Lease MRC ${eok(dash.revenue_summary.lease_mrc_eok)}/월 (ARR ${eok(dash.revenue_summary.lease_arr_eok)})`);
    lines.push(`• IRU OTC ${eok(dash.revenue_summary.iru_otc_eok)}, IRU 연O&M ${eok(dash.revenue_summary.iru_om_eok)}`);
    lines.push(`• 누적 매출(전체 계약 기간 합) ${eok(dash.revenue_summary.cumulative_revenue_eok)}`);
  }
  lines.push(...yearly.map((y) => `• ${y.year}년: 합계 ${eok(y.total_revenue_eok)} (Lease ${eok(y.lease_revenue_eok)}, IRU OTC ${eok(y.iru_otc_revenue_eok)}, IRU O&M ${eok(y.iru_om_revenue_eok)}), 신규계약 ${y.new_contract_count}건 / ${gbps(y.contracted_bandwidth_gbps)}`));
  if (years.length && !yearly.length) lines.push(`• ${years.join(', ')}년 매출 데이터는 집계 범위(2023~2028)에 없습니다.`);
  lines.push(`※ 기준환율 ${n(dash.fx_rate)} KRW/USD`);
  return { source: 'Revenue', text: lines.join('\n') };
}

function funnelSection(snap) {
  const lines = ['[Funnel 파이프라인]'];
  lines.push(`• ${snap.dash.funnel_summary.map((f) => `${f.stage} ${f.count}건/${gbps(f.bandwidth_gbps)}`).join(', ')}`);
  lines.push(...snap.funnel.map((f) => `• ${f.customer}: ${f.a_end || '?'}→${f.z_end || '?'} · ${gbps((f.if100g || 0) + (f.if400g || 0))} · ${f.stage} · ${f.priority} · 목표 ${f.target_date || '-'}`));
  return { source: 'Funnel', text: lines.join('\n') };
}

function lightupSection(snap, q, segments) {
  const sched = (q.match(/20\d\d\s*[ab]/gi) || []).map((s) => s.replace(/\s/g, '').toUpperCase());
  let rows = snap.lightup;
  if (sched.length) rows = rows.filter((r) => sched.includes(String(r.schedule).toUpperCase()));
  if (segments.length) rows = rows.filter((r) => segments.includes(r.segment_id));
  const lines = ['[Lightup 일정]'];
  if (!sched.length && !segments.length) {
    lines.push(`• ${snap.dash.lightup_summary.map((l) => `${l.status} ${gbps(l.qty_gbps)} (예상비용 ${usd(l.est_cost_usd)})`).join(', ')}`);
  }
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.schedule} · ${r.status}`;
    const g = groups.get(key) || { qty: 0, segs: new Set() };
    g.qty += (r.if100g || 0) + (r.if400g || 0);
    g.segs.add(r.segment_id);
    groups.set(key, g);
  }
  lines.push(...[...groups.entries()].map(([k, g]) => `• ${k}: ${gbps(g.qty)} (${[...g.segs].join(', ')})`));
  if (rows.length === 0) lines.push('• 조건에 맞는 Lightup 일정이 없습니다.');
  return { source: 'Lightup Schedule', text: lines.join('\n') };
}

function phaseSection(snap) {
  const lines = ['[단계별 증설 계획 (Tbps)]'];
  lines.push(...snap.phases.map((p) => `• ${p.segment_label}: 현재 ${n(p.current_tbps, 1)} → 1단계 ${n(p.phase1_tbps, 1)} → 2단계 ${n(p.phase2_tbps, 1)} → 3단계 ${n(p.phase3_tbps, 1)} → 4단계 ${n(p.phase4_tbps, 1)}`));
  return { source: 'Capacity Design · 단계별 계획', text: lines.join('\n') };
}

function demandSection(snap) {
  const lines = ['[내부수요 (Gbps, 반기별 H1~H6)]'];
  lines.push(...snap.demandS.map((d) => `• S ${d.segment_label} (${d.dls_code || '-'}): ${[d.h1, d.h2, d.h3, d.h4, d.h5, d.h6].map((v) => n(v)).join(' / ')}`));
  lines.push(...snap.demandL.map((d) => `• L ${d.segment_label}${d.pop ? ` (${d.pop})` : ''}: ${[d.h1, d.h2, d.h3, d.h4, d.h5].map((v) => n(v)).join(' / ')}`));
  return { source: '내부수요 (Gap)', text: lines.join('\n') };
}

function fxSection(snap) {
  return { source: '설정', text: `[환율]\n• 기준환율 ${n(snap.dash.fx_rate)} KRW/USD (설정 화면에서 관리)` };
}

function kpiSection(snap) {
  return {
    source: 'KPIs',
    text: `[KPI 메모]\n${snap.kpis.map((k) => `• ${k.year}년: ${k.memo || '메모 없음'}`).join('\n') || '• 등록된 KPI가 없습니다.'}`,
  };
}

function cableSection(snap, q) {
  const wanted = snap.cables.filter((c) => q.includes(String(c.cable_key || '').toLowerCase()) || q.includes(String(c.name || '').toLowerCase()));
  const rows = wanted.length ? wanted : snap.cables;
  if (!rows.length) return { source: '케이블 개요', text: '[케이블 프로젝트]\n• 등록된 케이블 개요 정보가 없습니다.' };
  return {
    source: '케이블 개요',
    text: `[케이블 프로젝트]\n${rows.map((c) => `• ${c.name || c.cable_key}: 서비스 ${c.service_year || '-'} · ${c.status || '-'}${c.summary ? ` · ${c.summary}` : ''}`).join('\n')}`,
  };
}

const EXAMPLES = [
  'Segment S 가용 용량 얼마나 남았어?',
  '한-싱 구간 현황 알려줘',
  '2026년 매출은?',
  '만료 예정 계약 보여줘',
  'Funnel 진행 상황은?',
  '2026B Lightup 일정',
];

const HELP_TEXT = `이 챗봇은 SJC2 Capacity Schedule 앱의 내부 데이터(Capacity·Lightup·Funnel·Contracts·매출·내부수요·KPI·환율·케이블 개요)만 근거로 답변합니다.\n예시 질문:\n${EXAMPLES.map((e) => `• ${e}`).join('\n')}`;

export const SUGGESTED_QUESTIONS = EXAMPLES;

/**
 * Rule-based answer composed only from the snapshot. Returns `matched: false` when the
 * question isn't about anything in the internal data — the bot then declines instead of guessing.
 */
export function answerLocally(question, snap) {
  const q = String(question || '').toLowerCase();
  const segments = matchSegments(q);
  const customers = matchCustomers(q, snap);
  const type = /\biru\b/.test(q) ? 'IRU' : /\blease\b|리스/.test(q) ? 'Lease' : null;

  const sections = [];
  const add = (s) => { if (!sections.some((x) => x.text === s.text)) sections.push(s); };

  if (has(q, ['도움', '사용법', '뭘 물어', '무엇을 물어', '뭐 할 수', 'help', '예시'])) {
    return { matched: true, message: HELP_TEXT, sources: [] };
  }

  if (customers.length) add(customerSection(snap, customers));

  const wantsCapacity = has(q, ['용량', '가용', '남은', '잔여', '여유', '사용률', '활용률', 'capacity', 'avail', '판매량', 'sold', '설계']);
  const wantsContracts = has(q, ['계약', 'contract', '만료', '갱신', '고객', 'active']) || type;
  const wantsRevenue = has(q, ['매출', '수익', 'revenue', 'mrc', 'arr', 'otc', 'o&m', '억', '돈', '얼마 벌']);
  const wantsFunnel = has(q, ['funnel', '퍼널', '파이프라인', 'pipeline', '영업', 'prospect', 'negotiation', '협상', '수주', 'signed']);
  const wantsPhase = has(q, ['단계', 'phase', '증설 계획', '증설계획', 'tbps']);
  const wantsLightup = has(q, ['lightup', 'light-up', '라이트업', '구축', '설치', '일정', '스케줄', 'schedule', '장비', '증설'])
    || /20\d\d\s*[ab]\b/i.test(q);
  const wantsDemand = has(q, ['내부수요', '내부 수요', '백본', 'gap', '수요']);
  const wantsFx = has(q, ['환율', 'fx', 'krw', '달러']);
  const wantsKpi = has(q, ['kpi', '목표']);
  const wantsCable = has(q, ['e2a', 'pae', '케이블 프로젝트', '서비스 예정', '다른 케이블']);

  if (wantsCapacity || (segments.length && !wantsContracts && !wantsLightup)) {
    add(segments.length ? segmentDetail(snap, segments) : capacitySummary(snap));
  }
  if (wantsContracts && !customers.length) add(contractsSection(snap, q, { segments, type }));
  if (wantsRevenue) add(revenueSection(snap, q));
  if (wantsFunnel && !customers.length) add(funnelSection(snap));
  if (wantsPhase) add(phaseSection(snap));
  if (wantsLightup && !wantsPhase) add(lightupSection(snap, q, segments));
  if (wantsDemand) add(demandSection(snap));
  if (wantsFx) add(fxSection(snap));
  if (wantsKpi) add(kpiSection(snap));
  if (wantsCable) add(cableSection(snap, q));

  if (!sections.length) {
    return {
      matched: false,
      message: `내부 데이터에서 질문과 관련된 정보를 찾지 못해 답변드리기 어렵습니다.\n${HELP_TEXT}`,
      sources: [],
    };
  }
  const picked = sections.slice(0, 4);
  return {
    matched: true,
    message: `${picked.map((s) => s.text).join('\n\n')}\n\n(${snap.asOf} 기준 내부 데이터)`,
    sources: [...new Set(picked.map((s) => s.source))],
  };
}

/** Full plain-text dump of the snapshot — the only knowledge an LLM is allowed to use. */
export function buildLlmContext(snap) {
  const blocks = [
    `[SJC2 Capacity Schedule 내부 데이터 — ${snap.asOf} 기준]`,
    capacitySummary(snap).text,
    segmentDetail(snap, segmentRows(snap).map((r) => r.segment_id)).text,
    revenueSection(snap, '').text,
    funnelSection(snap).text,
    lightupSection(snap, '', []).text,
    phaseSection(snap).text,
    demandSection(snap).text,
    fxSection(snap).text,
    kpiSection(snap).text,
    cableSection(snap, '').text,
    `[전체 계약 목록 ${snap.contracts.length}건]\n${snap.contracts.map(contractLine).join('\n')}`,
  ];
  return blocks.join('\n\n');
}
