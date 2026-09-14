import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { setFxRate, logActivity } from './calc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, '..', 'data', 'seed_data.json');

function toDateOnly(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

function num(v) {
  return v === null || v === undefined || v === '' ? 0 : Number(v);
}

async function seed() {
  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  const alreadySeeded = (await db.prepare(`SELECT COUNT(*) as c FROM capacity_design`).get()).c > 0;
  if (alreadySeeded && process.env.SEED_FORCE !== '1') {
    console.log('Database already has data. Skipping seed (set SEED_FORCE=1 to reseed).');
    return;
  }

  for (const t of ['capacity_design', 'capacity_phase', 'lightup_schedule', 'funnel', 'contracts', 'kpis', 'internal_demand_s', 'internal_demand_l', 'activity_log']) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }

  const insertCapacityDesign = db.prepare(`
    INSERT INTO capacity_design (seg_type, segment_id, segment_label, design_capacity_gbps, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const [i, r] of raw.capacity_design.rows.entries()) {
    const [segType, segmentId, segmentLabel, design] = r;
    await insertCapacityDesign.run(segType, segmentId, segmentLabel, num(design), i);
  }

  const insertPhase = db.prepare(`
    INSERT INTO capacity_phase (segment_label, current_tbps, phase1_tbps, phase2_tbps, phase3_tbps, phase4_tbps, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [i, r] of raw.capacity_phase.rows.entries()) {
    const [label, cur, p1, p2, p3, p4] = r;
    if (!label || label === '합계') continue;
    await insertPhase.run(label, num(cur), num(p1), num(p2), num(p3), num(p4), i);
  }

  const insertLightup = db.prepare(`
    INSERT INTO lightup_schedule (schedule, seg_type, segment_id, if100g, if400g, unit_price, status, complete_date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of raw.lightup_schedule.rows) {
    const [schedule, segType, segmentId, if100g, if400g, , unitPrice, , status, completeDate, note] = r;
    await insertLightup.run(schedule, segType, segmentId, num(if100g), num(if400g), num(unitPrice), status || '계획중', completeDate || null, note || null);
  }

  const insertFunnel = db.prepare(`
    INSERT INTO funnel (no, customer, a_end, z_end, if100g, if400g, stage, priority, target_date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of raw.funnel.rows) {
    const [no, customer, aEnd, zEnd, if100g, if400g, , stage, priority, targetDate, note] = r;
    await insertFunnel.run(num(no), customer, aEnd, zEnd, num(if100g), num(if400g), stage || 'Prospect', priority || 'Medium', toDateOnly(targetDate), note || null);
  }

  const insertContract = db.prepare(`
    INSERT INTO contracts (no, customer, contract_type, segment_s, segment_l, a_end, z_end, if100g, if400g, currency, mrc, otc, om_annual, contract_year, duration_months, start_date, status, cc_flag, am)
    VALUES (@no, @customer, @contract_type, @segment_s, @segment_l, @a_end, @z_end, @if100g, @if400g, @currency, @mrc, @otc, @om_annual, @contract_year, @duration_months, @start_date, @status, @cc_flag, @am)
  `);
  for (const r of raw.contracts.rows) {
    const [no, customer, contractType, segS, segL, aEnd, zEnd, if100g, if400g, bw, currency, mrc, otc, om, contractYear, durationMonths, startDate] = r;
    // columns after start_date: 만료일(skip), 총매출(skip), status, cc, am, then computed helper cols (skip)
    const status = r[19];
    const ccFlag = r[20];
    const am = r[21];
    await insertContract.run({
      no: String(no ?? ''),
      customer: customer || '',
      contract_type: contractType || 'Lease',
      segment_s: segS || null,
      segment_l: segL || null,
      a_end: aEnd || null,
      z_end: zEnd || null,
      if100g: num(if100g),
      if400g: num(if400g),
      currency: currency || 'USD',
      mrc: num(mrc),
      otc: num(otc),
      om_annual: num(om),
      contract_year: contractYear ? Number(contractYear) : null,
      duration_months: num(durationMonths),
      start_date: toDateOnly(startDate),
      status: status || '미정',
      cc_flag: ccFlag || null,
      am: am || null,
    });
  }

  const insertDemandS = db.prepare(`
    INSERT INTO internal_demand_s (dls_code, segment_label, h1, h2, h3, h4, h5, h6, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [i, r] of (raw.internal_demand_s?.rows || []).entries()) {
    const [dls, label, h1, h2, h3, h4, h5, h6] = r;
    await insertDemandS.run(dls || null, label || null, num(h1), num(h2), num(h3), num(h4), num(h5), num(h6), i);
  }

  const insertDemandL = db.prepare(`
    INSERT INTO internal_demand_l (pop, segment_label, h1, h2, h3, h4, h5, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [i, r] of (raw.internal_demand_l?.rows || []).entries()) {
    const [pop, label, h1, h2, h3, h4, h5] = r;
    await insertDemandL.run(pop || null, label || null, num(h1), num(h2), num(h3), num(h4), num(h5), i);
  }

  const insertKpi = db.prepare(`INSERT INTO kpis (year, memo) VALUES (?, ?)`);
  for (const r of raw.kpis.rows) {
    const [year, memo] = r;
    if (year) await insertKpi.run(Number(year), memo || null);
  }

  await setFxRate(1380);

  // Log sheet rows are [No, Dates, 내용]
  for (const r of raw.log.rows) {
    const [, , , dateStr, content] = r;
    if (content) {
      const message = String(content).trim();
      const at = toDateOnly(dateStr) || undefined;
      if (at) {
        await db.prepare(`INSERT INTO activity_log (at, message) VALUES (?, ?)`).run(at, message);
      } else {
        await logActivity(message);
      }
    }
  }

  await logActivity('초기 데이터 임포트 (SJC2_Capacity_Schedule_v2_3_3.xlsx)');

  console.log('Seed complete:', {
    capacity_design: raw.capacity_design.rows.length,
    lightup_schedule: raw.lightup_schedule.rows.length,
    funnel: raw.funnel.rows.length,
    contracts: raw.contracts.rows.length,
    kpis: raw.kpis.rows.length,
    internal_demand_s: (raw.internal_demand_s?.rows || []).length,
    internal_demand_l: (raw.internal_demand_l?.rows || []).length,
  });
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
