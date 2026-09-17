import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { logActivity } from '../calc.js';
import { TABLE_DEFS } from '../tableDefs.js';
import { buildDashboard } from '../dashboard.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('.xlsx 파일만 업로드할 수 있습니다'));
  },
});

function cellForExport(col, rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (col.number) return Number(rawValue);
  if (rawValue instanceof Date) return rawValue.toISOString().slice(0, 10);
  return String(rawValue);
}

function round2(v) {
  return typeof v === 'number' ? Math.round(v * 100) / 100 : v;
}

function addPlainSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 2) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  return ws;
}

const SEGMENT_DETAIL_COLUMNS = [
  { key: 'segment_label', label: 'Segment' },
  { key: 'design', label: 'Design' },
  { key: 'equip100', label: 'Equip 100G' },
  { key: 'equip400', label: 'Equip 400G' },
  { key: 'construct100', label: '구축중 100G' },
  { key: 'construct400', label: '구축중 400G' },
  { key: 'sold100', label: 'Sold 100G' },
  { key: 'sold400', label: 'Sold 400G' },
  { key: 'avail100', label: 'Avail 100G' },
  { key: 'avail400', label: 'Avail 400G' },
  { key: 'sold_total', label: 'Sold 합계' },
  { key: 'avail_total', label: 'Avail 합계' },
];

// Dashboard is a computed/aggregated view (not a raw editable table), so these sheets
// are export-only reporting snapshots — /import intentionally ignores them since it
// only looks up sheets by TABLE_DEFS[].sheet name.
async function addDashboardSheets(wb) {
  const dash = await buildDashboard();

  addPlainSheet(wb, 'Dashboard_요약', [
    { key: 'item', label: '항목' },
    { key: 'value', label: '값' },
  ], [
    { item: '기준일', value: new Date().toISOString().slice(0, 10) },
    { item: '기준환율(KRW/USD)', value: dash.fx_rate },
    { item: 'KPI 연도', value: dash.current_kpi?.year ?? '' },
    { item: 'KPI 메모', value: dash.current_kpi?.memo ?? '' },
    { item: 'Active 계약 수', value: dash.headline.active_contracts_count },
    { item: 'Active 총 대역폭(Gbps)', value: round2(dash.headline.active_bandwidth_gbps) },
    { item: 'Lease MRC(억원/월)', value: round2(dash.headline.lease_mrc_eok) },
    { item: '누적 매출(억원)', value: round2(dash.headline.cumulative_revenue_eok) },
    { item: 'Segment S 사용률(%)', value: dash.segment_s_utilization_pct },
    { item: 'Lease ARR(억원/년)', value: round2(dash.revenue_summary.lease_arr_eok) },
    { item: 'IRU OTC(억원)', value: round2(dash.revenue_summary.iru_otc_eok) },
    { item: 'IRU 연O&M(억원)', value: round2(dash.revenue_summary.iru_om_eok) },
  ]);

  addPlainSheet(wb, 'Dashboard_SegmentS', SEGMENT_DETAIL_COLUMNS, [...dash.segment_s.rows, dash.segment_s.total]);
  addPlainSheet(wb, 'Dashboard_SegmentL', SEGMENT_DETAIL_COLUMNS, [...dash.segment_l.rows, dash.segment_l.total]);

  addPlainSheet(wb, 'Dashboard_Funnel', [
    { key: 'stage', label: 'Stage' },
    { key: 'count', label: '건수' },
    { key: 'bandwidth_gbps', label: 'BW(Gbps)' },
  ], dash.funnel_summary);

  addPlainSheet(wb, 'Dashboard_Lightup', [
    { key: 'status', label: 'Status' },
    { key: 'qty_gbps', label: 'Qty(Gbps)' },
    { key: 'est_cost_usd', label: 'Est. Cost($)' },
  ], dash.lightup_summary.map((l) => ({ ...l, est_cost_usd: round2(l.est_cost_usd) })));

  addPlainSheet(wb, 'Dashboard_연도별매출', [
    { key: 'year', label: '연도' },
    { key: 'lease_revenue_eok', label: 'Lease 매출(억원)' },
    { key: 'iru_otc_revenue_eok', label: 'IRU OTC(억원)' },
    { key: 'iru_om_revenue_eok', label: 'IRU O&M(억원)' },
    { key: 'total_revenue_eok', label: '총매출(억원)' },
    { key: 'contracted_bandwidth_gbps', label: '신규계약 BW(Gbps)' },
    { key: 'new_contract_count', label: '신규계약 건수' },
  ], dash.revenue_yearly.map((y) => ({
    ...y,
    lease_revenue_eok: round2(y.lease_revenue_eok),
    iru_otc_revenue_eok: round2(y.iru_otc_revenue_eok),
    iru_om_revenue_eok: round2(y.iru_om_revenue_eok),
    total_revenue_eok: round2(y.total_revenue_eok),
  })));
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SJC2 Capacity Schedule';
  wb.created = new Date();

  for (const def of TABLE_DEFS) {
    const rows = await db.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.orderBy}`).all();
    const ws = wb.addWorksheet(def.sheet);
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      ...def.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 2) })),
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rows) {
      const rowObj = { id: r.id };
      for (const c of def.columns) rowObj[c.key] = cellForExport(c, r[c.key]);
      ws.addRow(rowObj);
    }
  }

  await addDashboardSheets(wb);

  return wb;
}

function cellToValue(cell, col) {
  let v = cell?.value;
  if (v && typeof v === 'object') {
    if ('result' in v) v = v.result;
    else if (v instanceof Date) v = v;
    else if ('text' in v) v = v.text;
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('');
  }
  if (v === null || v === undefined || v === '') return null;
  if (col.date) return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  if (col.number) return Number(v);
  return String(v).trim();
}

function readSheetRows(ws, def) {
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const idCell = row.getCell(1);
    const parsed = { id: idCell.value ?? null };
    let hasData = idCell.value !== null && idCell.value !== undefined && idCell.value !== '';
    def.columns.forEach((c, i) => {
      const value = cellToValue(row.getCell(i + 2), c);
      parsed[c.key] = value;
      if (value !== null) hasData = true;
    });
    if (hasData) rows.push(parsed);
  });
  return rows;
}

function valuesEqual(col, a, b) {
  if (col.number) {
    const na = a === null || a === undefined || a === '' ? null : Number(a);
    const nb = b === null || b === undefined || b === '' ? null : Number(b);
    if (na === null || nb === null) return na === nb;
    return Math.abs(na - nb) < 1e-9;
  }
  const sa = a === null || a === undefined ? '' : String(a).trim();
  const sb = b === null || b === undefined ? '' : String(b).trim();
  return sa === sb;
}

async function importSheet(def, ws) {
  const existing = await db.prepare(`SELECT * FROM ${def.table}`).all();
  const existingById = new Map(existing.map((r) => [String(r.id), r]));
  const parsedRows = readSheetRows(ws, def);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const parsed of parsedRows) {
    const idKey = parsed.id !== null && parsed.id !== undefined && parsed.id !== '' ? String(parsed.id) : null;
    const existingRow = idKey ? existingById.get(idKey) : null;

    if (existingRow) {
      const changed = def.columns.some((c) => !valuesEqual(c, existingRow[c.key], parsed[c.key]));
      if (!changed) {
        unchanged += 1;
        continue;
      }
      const payload = Object.fromEntries(def.columns.map((c) => [c.key, parsed[c.key]]));
      payload.id = idKey;
      await db.prepare(`
        UPDATE ${def.table} SET ${def.columns.map((c) => `${c.key} = @${c.key}`).join(', ')} WHERE id = @id
      `).run(payload);
      updated += 1;
    } else {
      const payload = Object.fromEntries(def.columns.map((c) => [c.key, parsed[c.key] ?? null]));
      await db.prepare(`
        INSERT INTO ${def.table} (${def.columns.map((c) => c.key).join(', ')})
        VALUES (${def.columns.map((c) => `@${c.key}`).join(', ')})
      `).run(payload);
      created += 1;
    }
  }

  return { table: def.table, sheet: def.sheet, created, updated, unchanged };
}

router.get('/export', async (req, res, next) => {
  try {
    const wb = await buildWorkbook();
    const buf = await wb.xlsx.writeBuffer();
    const filename = `SJC2_Capacity_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

router.post('/import', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '엑셀 파일을 첨부해 주세요' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    const results = [];
    for (const def of TABLE_DEFS) {
      const ws = wb.getWorksheet(def.sheet);
      if (!ws) continue;
      results.push(await importSheet(def, ws));
    }

    const summary = results
      .filter((r) => r.created || r.updated)
      .map((r) => `${r.table} 추가 ${r.created}/수정 ${r.updated}`)
      .join(', ');
    await logActivity(`[data-io] 엑셀 업로드 반영${summary ? `: ${summary}` : ' (변경 없음)'}`);

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// Local error handler so upload/parsing failures (bad file type, corrupt workbook,
// bad data hitting a DB constraint) reach the client as JSON instead of Express's
// default HTML error page, which the frontend can't render as a readable message.
router.use((err, req, res, next) => {
  if (!err) return next();
  res.status(err.status || 400).json({ error: err.message || '요청을 처리할 수 없습니다' });
});

export default router;
