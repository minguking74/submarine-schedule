import { db } from './db.js';

export function getFxRate() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'fx_rate'`).get();
  return row ? Number(row.value) : 1380;
}

export function setFxRate(rate) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('fx_rate', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(rate));
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  return result.toISOString().slice(0, 10);
}

function toUsd(amount, currency, rate) {
  const v = Number(amount) || 0;
  if (currency === 'KRW') return v / rate;
  return v;
}

/** Enriches a raw contract row with every derived field the Excel workbook computed via formula. */
export function enrichContract(row, rate = getFxRate()) {
  const bandwidth = (Number(row.if100g) || 0) + (Number(row.if400g) || 0);
  const endDate = row.start_date && row.duration_months
    ? addMonths(row.start_date, row.duration_months)
    : null;

  const mrcUsd = toUsd(row.mrc, row.currency, rate);
  const otcUsd = toUsd(row.otc, row.currency, rate);
  const omUsd = toUsd(row.om_annual, row.currency, rate);

  const months = Number(row.duration_months) || 0;
  const monthlyOtcUsd = months > 0 ? otcUsd / months : 0;
  const monthlyOmUsd = omUsd / 12;
  const monthlyTotalUsd = mrcUsd + monthlyOtcUsd + monthlyOmUsd;
  const totalRevenueUsd = mrcUsd * months + otcUsd + omUsd * (months / 12);

  const segL = row.segment_l || '';
  const lIncludesGs = /GS|Global Switch/i.test(segL);
  const lIncludesSg3 = /SG3/i.test(segL);
  const lIncludesMegai = /Mega-?i/i.test(segL);

  return {
    ...row,
    bandwidth,
    end_date: endDate,
    mrc_usd: mrcUsd,
    otc_usd: otcUsd,
    om_usd: omUsd,
    monthly_otc_usd: monthlyOtcUsd,
    monthly_om_usd: monthlyOmUsd,
    monthly_total_usd: monthlyTotalUsd,
    total_revenue_usd: totalRevenueUsd,
    l_includes_gs: lIncludesGs ? 1 : 0,
    l_includes_sg3: lIncludesSg3 ? 1 : 0,
    l_includes_megai: lIncludesMegai ? 1 : 0,
  };
}

export function listEnrichedContracts() {
  const rate = getFxRate();
  const rows = db.prepare(`SELECT * FROM contracts ORDER BY id`).all();
  return rows.map((r) => enrichContract(r, rate));
}

/** Monthly revenue recognized by a contract for a given calendar month, split by type. */
function contractMonthlyRevenue(contract, year, month) {
  if (!contract.start_date || !contract.duration_months) {
    return { lease: 0, iru_otc: 0, iru_om: 0 };
  }
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(contract.start_date);
  const end = new Date(contract.end_date);
  const startMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  if (monthStart < startMonth || monthStart >= endMonth) {
    return { lease: 0, iru_otc: 0, iru_om: 0 };
  }
  if (contract.contract_type === 'IRU') {
    return { lease: 0, iru_otc: contract.monthly_otc_usd, iru_om: contract.monthly_om_usd };
  }
  return { lease: contract.mrc_usd, iru_otc: 0, iru_om: 0 };
}

/** Builds Revenue_Monthly-equivalent rows for a [fromYear, toYear] range, computed on the fly. */
export function buildRevenueMonthly(fromYear, toYear) {
  const contracts = listEnrichedContracts();
  const rows = [];
  for (const c of contracts) {
    for (let year = fromYear; year <= toYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const rev = contractMonthlyRevenue(c, year, month);
        if (rev.lease || rev.iru_otc || rev.iru_om) {
          rows.push({
            contract_no: c.no,
            customer: c.customer,
            contract_type: c.contract_type,
            segment_s: c.segment_s,
            segment_l: c.segment_l,
            status: c.status,
            year,
            month,
            year_month: `${year}-${String(month).padStart(2, '0')}`,
            lease_revenue_usd: rev.lease,
            iru_otc_revenue_usd: rev.iru_otc,
            iru_om_revenue_usd: rev.iru_om,
          });
        }
      }
    }
  }
  return rows;
}

export function buildRevenueYearly(fromYear, toYear) {
  const rate = getFxRate();
  const monthly = buildRevenueMonthly(fromYear, toYear);
  const contracts = listEnrichedContracts();
  const years = [];
  for (let year = fromYear; year <= toYear; year++) {
    const rowsForYear = monthly.filter((r) => r.year === year);
    const leaseKrwEok = rowsForYear.reduce((s, r) => s + r.lease_revenue_usd, 0) * rate / 1e8;
    const iruOtcKrwEok = rowsForYear.reduce((s, r) => s + r.iru_otc_revenue_usd, 0) * rate / 1e8;
    const iruOmKrwEok = rowsForYear.reduce((s, r) => s + r.iru_om_revenue_usd, 0) * rate / 1e8;
    const contractsThisYear = contracts.filter((c) => c.contract_year === year);
    years.push({
      year,
      lease_revenue_eok: leaseKrwEok,
      iru_otc_revenue_eok: iruOtcKrwEok,
      iru_om_revenue_eok: iruOmKrwEok,
      total_revenue_eok: leaseKrwEok + iruOtcKrwEok + iruOmKrwEok,
      contracted_bandwidth_gbps: contractsThisYear.reduce((s, c) => s + c.bandwidth, 0),
      new_contract_count: contractsThisYear.length,
    });
  }
  return years;
}

export function logActivity(message) {
  db.prepare(`INSERT INTO activity_log (message) VALUES (?)`).run(message);
}
