import { db } from './db.js';
import { getFxRate, listEnrichedContracts, buildRevenueYearly } from './calc.js';

const SEGMENT_L_IDS = ['CLS-GS', 'CLS-SG3', 'CLS-Mega-i'];

function segmentSoldForS(contracts, segmentId) {
  const active = contracts.filter((c) => c.status === 'Active' && c.segment_s === segmentId);
  return {
    sold100: active.reduce((s, c) => s + (Number(c.if100g) || 0), 0),
    sold400: active.reduce((s, c) => s + (Number(c.if400g) || 0), 0),
  };
}

function segmentSoldForL(contracts, segmentId) {
  const flagKey = segmentId === 'CLS-GS' ? 'l_includes_gs'
    : segmentId === 'CLS-SG3' ? 'l_includes_sg3'
    : 'l_includes_megai';
  const active = contracts.filter((c) => c.status === 'Active' && c[flagKey] === 1);
  return {
    sold100: active.reduce((s, c) => s + (Number(c.if100g) || 0), 0),
    sold400: active.reduce((s, c) => s + (Number(c.if400g) || 0), 0),
  };
}

async function lightupAgg(segmentId, status) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(if100g),0) as q100, COALESCE(SUM(if400g),0) as q400
     FROM lightup_schedule WHERE segment_id = ? AND status = ?`
  ).get(segmentId, status);
  return { q100: Number(row.q100), q400: Number(row.q400) };
}

export async function buildSegmentDetail(segType, contracts) {
  const segments = await db.prepare(
    `SELECT * FROM capacity_design WHERE seg_type = ? ORDER BY sort_order, id`
  ).all(segType);

  const details = [];
  for (const seg of segments) {
    const equip = await lightupAgg(seg.segment_id, '설치완료');
    const constr = await lightupAgg(seg.segment_id, '구축중');
    const sold = segType === 'S'
      ? segmentSoldForS(contracts, seg.segment_id)
      : segmentSoldForL(contracts, seg.segment_id);
    const avail100 = equip.q100 - sold.sold100;
    const avail400 = equip.q400 - sold.sold400;
    details.push({
      segment_id: seg.segment_id,
      segment_label: seg.segment_label,
      design: seg.design_capacity_gbps,
      equip100: equip.q100,
      equip400: equip.q400,
      construct100: constr.q100,
      construct400: constr.q400,
      sold100: sold.sold100,
      sold400: sold.sold400,
      avail100,
      avail400,
      sold_total: sold.sold100 + sold.sold400,
      avail_total: avail100 + avail400,
      buildable_remaining: segType === 'S'
        ? seg.design_capacity_gbps - (equip.q100 + equip.q400 + constr.q100 + constr.q400)
        : null,
    });
  }

  const total = details.reduce((acc, d) => {
    acc.design += d.design;
    acc.equip100 += d.equip100;
    acc.equip400 += d.equip400;
    acc.construct100 += d.construct100;
    acc.construct400 += d.construct400;
    acc.sold100 += d.sold100;
    acc.sold400 += d.sold400;
    acc.avail100 += d.avail100;
    acc.avail400 += d.avail400;
    acc.sold_total += d.sold_total;
    acc.avail_total += d.avail_total;
    return acc;
  }, { segment_id: 'TOTAL', segment_label: 'TOTAL', design: 0, equip100: 0, equip400: 0, construct100: 0, construct400: 0, sold100: 0, sold400: 0, avail100: 0, avail400: 0, sold_total: 0, avail_total: 0 });

  return { rows: details, total };
}

async function fundraisingStageAgg() {
  const stages = ['Prospect', 'Negotiation', 'Signed', 'Active'];
  const result = [];
  for (const stage of stages) {
    const row = await db.prepare(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(if100g + if400g),0) as bw
       FROM funnel WHERE stage = ?`
    ).get(stage);
    result.push({ stage, count: Number(row.cnt), bandwidth_gbps: Number(row.bw) });
  }
  return result;
}

async function lightupStatusAgg() {
  const statuses = ['설치완료', '구축중', '계획중'];
  const result = [];
  for (const status of statuses) {
    const rows = await db.prepare(`SELECT if100g, if400g, unit_price FROM lightup_schedule WHERE status = ?`).all(status);
    const qty = rows.reduce((s, r) => s + (r.if100g || 0) + (r.if400g || 0), 0);
    const cost = rows.reduce((s, r) => s + (((r.if100g || 0) + (r.if400g || 0)) / 100) * (r.unit_price || 0), 0);
    result.push({ status, qty_gbps: qty, est_cost_usd: cost });
  }
  return result;
}

export async function buildDashboard() {
  const rate = await getFxRate();
  const contracts = await listEnrichedContracts();
  const activeContracts = contracts.filter((c) => c.status === 'Active');

  const segmentS = await buildSegmentDetail('S', contracts);
  const segmentLDetails = [];
  for (const id of SEGMENT_L_IDS) {
    const seg = await db.prepare(`SELECT * FROM capacity_design WHERE segment_id = ?`).get(id);
    if (!seg) continue;
    const equip = await lightupAgg(id, '설치완료');
    const constr = await lightupAgg(id, '구축중');
    const sold = segmentSoldForL(contracts, id);
    segmentLDetails.push({
      segment_id: id,
      segment_label: seg.segment_label,
      design: seg.design_capacity_gbps,
      equip100: equip.q100,
      equip400: equip.q400,
      construct100: constr.q100,
      construct400: constr.q400,
      sold100: sold.sold100,
      sold400: sold.sold400,
      avail100: equip.q100 - sold.sold100,
      avail400: equip.q400 - sold.sold400,
    });
  }

  const segmentLTotal = segmentLDetails.reduce((acc, d) => {
    acc.design += d.design; acc.equip100 += d.equip100; acc.equip400 += d.equip400;
    acc.construct100 += d.construct100; acc.construct400 += d.construct400;
    acc.sold100 += d.sold100; acc.sold400 += d.sold400;
    acc.avail100 += d.avail100; acc.avail400 += d.avail400;
    return acc;
  }, { segment_id: 'TOTAL', segment_label: 'TOTAL', design: 0, equip100: 0, equip400: 0, construct100: 0, construct400: 0, sold100: 0, sold400: 0, avail100: 0, avail400: 0 });

  const designSRow = await db.prepare(`SELECT COALESCE(SUM(design_capacity_gbps),0) as t FROM capacity_design WHERE seg_type='S'`).get();
  const designSTotal = Number(designSRow.t);
  const activeBandwidthAll = activeContracts.reduce((s, c) => s + c.bandwidth, 0);
  const utilizationPct = designSTotal > 0 ? Math.round((activeBandwidthAll / designSTotal) * 100) : 0;

  const leaseMrcEok = activeContracts.filter((c) => c.contract_type === 'Lease')
    .reduce((s, c) => s + c.mrc_usd, 0) * rate / 1e8;
  const iruOtcEok = activeContracts.filter((c) => c.contract_type === 'IRU')
    .reduce((s, c) => s + c.otc_usd, 0) * rate / 1e8;
  const iruOmEok = activeContracts.filter((c) => c.contract_type === 'IRU')
    .reduce((s, c) => s + c.om_usd, 0) * rate / 1e8;
  const cumulativeRevenueEok = contracts.reduce((s, c) => s + c.total_revenue_usd, 0) * rate / 1e8;

  const currentKpi = await db.prepare(`SELECT * FROM kpis ORDER BY year DESC LIMIT 1`).get();

  const years = await buildRevenueYearly(2023, 2028);

  return {
    fx_rate: rate,
    current_kpi: currentKpi || null,
    headline: {
      active_contracts_count: activeContracts.length,
      active_bandwidth_gbps: activeBandwidthAll,
      lease_mrc_eok: leaseMrcEok,
      cumulative_revenue_eok: cumulativeRevenueEok,
    },
    segment_s_utilization_pct: utilizationPct,
    segment_s: segmentS,
    segment_l: { rows: segmentLDetails, total: segmentLTotal },
    revenue_summary: {
      lease_mrc_eok: leaseMrcEok,
      lease_arr_eok: leaseMrcEok * 12,
      iru_otc_eok: iruOtcEok,
      iru_om_eok: iruOmEok,
      cumulative_revenue_eok: cumulativeRevenueEok,
    },
    funnel_summary: await fundraisingStageAgg(),
    lightup_summary: await lightupStatusAgg(),
    revenue_yearly: years,
  };
}
