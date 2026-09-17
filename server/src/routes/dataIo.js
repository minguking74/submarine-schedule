import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { logActivity, getFxRate } from '../calc.js';
import { TABLE_DEFS } from '../tableDefs.js';

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
  if (col.date) {
    // Written as a real Excel date (not text) so date arithmetic in the Dashboard
    // sheet's formulas (EDATE/YEAR/MONTH) works — a text-looking date breaks those.
    const d = rawValue instanceof Date ? rawValue : new Date(rawValue);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (rawValue instanceof Date) return rawValue.toISOString().slice(0, 10);
  return String(rawValue);
}

function styleHeaderRow(row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
}

const YEAR_FROM = 2023;
const YEAR_TO = 2028; // matches buildDashboard()/buildRevenueYearly()'s default range

// Segment L rows are identified by these fixed segment_ids (see server/src/dashboard.js
// SEGMENT_L_IDS) and by the matching L-포함 flag column added to the Contracts sheet.
const SEGMENT_L_DEFS = [
  { segmentId: 'CLS-GS', flagCol: 'AC' },
  { segmentId: 'CLS-SG3', flagCol: 'AD' },
  { segmentId: 'CLS-Mega-i', flagCol: 'AE' },
];

/**
 * Adds the derived columns the original spreadsheet computed via formula (Bandwidth,
 * end date, USD-normalized monthly/total revenue, L-segment flags) to the Contracts
 * sheet as real Excel formulas — so the Dashboard sheet's SUMIF/SUMPRODUCT formulas
 * have something to reference, and editing raw contract data in Excel recalculates
 * everything live. These are appended after TABLE_DEFS' columns, so /import (which only
 * reads columns by their defined position) safely ignores them.
 */
function addContractsFormulaColumns(ws, lastRow) {
  const headers = [
    'Bandwidth (Gbps)', '만료일', '월매출(USD,회계기준)', 'IRU OTC 월매출(USD)', 'IRU O&M 월매출(USD)',
    '총 매출(USD)', 'OTC총액(USD)', '연OM총액(USD)', 'L포함_GS', 'L포함_SG3', 'L포함_Mega-i',
  ];
  const headerRow = ws.getRow(1);
  headers.forEach((h, i) => { headerRow.getCell(21 + i).value = h; }); // U..AE (col 21 = U)

  const fx = 'Dashboard!$C$4'; // fx rate cell, cross-sheet ref since this is the Contracts sheet
  // U..AE mirror server/src/calc.js exactly, field for field, so this sheet's totals match
  // what the live Dashboard page shows:
  //  - W is plain mrc_usd (enrichContract), consumed only through SUMIFS/SUMPRODUCT that
  //    already filter to contract_type="Lease", matching buildRevenueMonthly's `rev.lease`.
  //  - X/Y are monthly_otc_usd/monthly_om_usd, zeroed for non-IRU rows to match
  //    buildRevenueMonthly's explicit `contract_type==='IRU'` branch.
  //  - Z is total_revenue_usd (enrichContract), summed unconditionally (no type branch)
  //    for the cumulative-revenue headline, same as calc.js.
  for (let r = 2; r <= lastRow; r++) {
    const mrcUsd = `IF(K${r}="KRW",L${r}/${fx},L${r})`;
    const otcUsd = `IF(K${r}="KRW",M${r}/${fx},M${r})`;
    const omUsd = `IF(K${r}="KRW",N${r}/${fx},N${r})`;
    const monthlyOtcUsd = `IF(P${r}=0,0,(${otcUsd})/P${r})`;
    const monthlyOmUsd = `(${omUsd})/12`;
    const isIru = `D${r}="IRU"`;

    ws.getCell(`U${r}`).value = { formula: `I${r}+J${r}` };
    ws.getCell(`V${r}`).value = { formula: `EDATE(Q${r},P${r})` };
    ws.getCell(`W${r}`).value = { formula: mrcUsd };
    ws.getCell(`X${r}`).value = { formula: `IF(${isIru},${monthlyOtcUsd},0)` };
    ws.getCell(`Y${r}`).value = { formula: `IF(${isIru},${monthlyOmUsd},0)` };
    ws.getCell(`Z${r}`).value = { formula: `(${mrcUsd})*P${r}+(${otcUsd})+(${omUsd})*(P${r}/12)` };
    ws.getCell(`AA${r}`).value = { formula: `IF(${isIru},${otcUsd},0)` };
    ws.getCell(`AB${r}`).value = { formula: `IF(${isIru},${omUsd},0)` };
    ws.getCell(`AC${r}`).value = { formula: `IF(ISNUMBER(SEARCH("GS",F${r})),1,0)` };
    ws.getCell(`AD${r}`).value = { formula: `IF(ISNUMBER(SEARCH("SG3",F${r})),1,0)` };
    ws.getCell(`AE${r}`).value = { formula: `IF(ISNUMBER(SEARCH("Mega",F${r})),1,0)` };
  }
}

function addFunnelFormulaColumn(ws, lastRow) {
  ws.getRow(1).getCell(12).value = 'Bandwidth (Gbps)'; // L
  for (let r = 2; r <= lastRow; r++) ws.getCell(`L${r}`).value = { formula: `F${r}+G${r}` };
}

function addLightupFormulaColumn(ws, lastRow) {
  ws.getRow(1).getCell(11).value = 'Est. Cost ($)'; // K
  for (let r = 2; r <= lastRow; r++) ws.getCell(`K${r}`).value = { formula: `((E${r}+F${r})/100)*G${r}` };
}

function overlapMonthsExpr(cLast, year) {
  const startIdx = `(YEAR(Contracts!$Q$2:$Q$${cLast})*12+MONTH(Contracts!$Q$2:$Q$${cLast}))`;
  const endIdx = `(YEAR(Contracts!$V$2:$V$${cLast})*12+MONTH(Contracts!$V$2:$V$${cLast}))`;
  const yearStart = year * 12 + 1;
  const yearEndExcl = (year + 1) * 12 + 1;
  const cappedEnd = `IF(${endIdx}>${yearEndExcl},${yearEndExcl},${endIdx})`;
  const flooredStart = `IF(${startIdx}<${yearStart},${yearStart},${startIdx})`;
  return `IF((${cappedEnd}-${flooredStart})<0,0,(${cappedEnd}-${flooredStart}))`;
}

/** Writes a Segment S/L detail table (per-segment SUMIF/SUMIFS formulas + TOTAL row). */
function writeSegmentTable(ws, startRow, title, segments, { cLast, lLast, isSegmentS }) {
  const bold = { font: { bold: true } };
  let r = startRow;
  ws.getCell(`B${r}`).value = title;
  ws.getCell(`B${r}`).font = { bold: true, size: 12 };
  r += 1;

  const headers = ['Segment', 'Design', 'Equip 100G', 'Equip 400G', '구축중 100G', '구축중 400G', 'Sold 100G', 'Sold 400G', 'Avail 100G', 'Avail 400G', 'Sold 합계', 'Avail 합계'];
  if (isSegmentS) headers.push('추가 구축 가능');
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, 2 + i);
    cell.value = h;
    cell.font = bold.font;
  });
  r += 1;

  const firstDataRow = r;
  for (const seg of segments) {
    const sid = seg.segmentId.replace(/"/g, '""');
    ws.getCell(`B${r}`).value = seg.label;
    ws.getCell(`C${r}`).value = { formula: `SUMIF(CapacityDesign!$C$2:$C$${seg.capLast},"${sid}",CapacityDesign!$E$2:$E$${seg.capLast})` };
    ws.getCell(`D${r}`).value = { formula: `SUMIFS(Lightup!$E$2:$E$${lLast},Lightup!$D$2:$D$${lLast},"${sid}",Lightup!$H$2:$H$${lLast},"설치완료")` };
    ws.getCell(`E${r}`).value = { formula: `SUMIFS(Lightup!$F$2:$F$${lLast},Lightup!$D$2:$D$${lLast},"${sid}",Lightup!$H$2:$H$${lLast},"설치완료")` };
    ws.getCell(`F${r}`).value = { formula: `SUMIFS(Lightup!$E$2:$E$${lLast},Lightup!$D$2:$D$${lLast},"${sid}",Lightup!$H$2:$H$${lLast},"구축중")` };
    ws.getCell(`G${r}`).value = { formula: `SUMIFS(Lightup!$F$2:$F$${lLast},Lightup!$D$2:$D$${lLast},"${sid}",Lightup!$H$2:$H$${lLast},"구축중")` };
    if (isSegmentS) {
      ws.getCell(`H${r}`).value = { formula: `SUMIFS(Contracts!$I$2:$I$${cLast},Contracts!$E$2:$E$${cLast},"${sid}",Contracts!$R$2:$R$${cLast},"Active")` };
      ws.getCell(`I${r}`).value = { formula: `SUMIFS(Contracts!$J$2:$J$${cLast},Contracts!$E$2:$E$${cLast},"${sid}",Contracts!$R$2:$R$${cLast},"Active")` };
    } else {
      ws.getCell(`H${r}`).value = { formula: `SUMIFS(Contracts!$I$2:$I$${cLast},Contracts!$${seg.flagCol}$2:$${seg.flagCol}$${cLast},1,Contracts!$R$2:$R$${cLast},"Active")` };
      ws.getCell(`I${r}`).value = { formula: `SUMIFS(Contracts!$J$2:$J$${cLast},Contracts!$${seg.flagCol}$2:$${seg.flagCol}$${cLast},1,Contracts!$R$2:$R$${cLast},"Active")` };
    }
    ws.getCell(`J${r}`).value = { formula: `D${r}-H${r}` };
    ws.getCell(`K${r}`).value = { formula: `E${r}-I${r}` };
    ws.getCell(`L${r}`).value = { formula: `H${r}+I${r}` };
    ws.getCell(`M${r}`).value = { formula: `J${r}+K${r}` };
    if (isSegmentS) ws.getCell(`N${r}`).value = { formula: `C${r}-SUM(D${r}:G${r})` };
    r += 1;
  }
  const lastDataRow = r - 1;

  ws.getCell(`B${r}`).value = 'TOTAL';
  ws.getCell(`B${r}`).font = bold.font;
  const cols = isSegmentS ? ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'] : ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  for (const col of cols) {
    ws.getCell(`${col}${r}`).value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})` };
    ws.getCell(`${col}${r}`).font = bold.font;
  }
  return r + 1;
}

/**
 * Builds the formula-driven Dashboard sheet, mirroring the original workbook's Dashboard
 * tab: every figure is a live SUMIF/SUMIFS/COUNTIF/SUMPRODUCT formula referencing the
 * other sheets in this same file, so editing raw data in Excel recalculates it —
 * matching how the source template worked, instead of pasting in computed snapshot values.
 * It is not part of TABLE_DEFS, so /import ignores it (read-only reporting view).
 */
function addDashboardSheet(wb, ctx) {
  const { fxRate, cLast, fLast, lLast, kLast, capLast, segmentSRows, segmentLRows } = ctx;
  const ws = wb.addWorksheet('Dashboard');
  ws.getColumn(1).width = 2;
  for (let c = 2; c <= 13; c++) ws.getColumn(c).width = 13;
  ws.views = [{ state: 'frozen', ySplit: 0 }];

  let r = 1;
  ws.getCell(`B${r}`).value = '🛰️ SJC2 Capacity Schedule Management';
  ws.getCell(`B${r}`).font = { bold: true, size: 14 };
  r += 1;
  ws.getCell(`B${r}`).value = '데이터 입력 시 전체 수식이 자동 갱신됩니다 (Contracts/Lightup/Funnel/KPI/CapacityDesign 시트를 수정해 보세요)';
  r += 2;

  ws.getCell(`B${r}`).value = '기준환율 (KRW per USD)';
  ws.getCell(`B${r}`).font = { bold: true };
  const fxRow = r;
  // Contracts' derived columns (addContractsFormulaColumns) hardcode this cell as
  // 'Dashboard!$C$4' since they're written before this sheet exists. If the layout
  // above ever shifts this row, that hardcoded reference must move with it.
  if (fxRow !== 4) throw new Error(`Dashboard fx rate row moved to ${fxRow}; update the 'Dashboard!$C$4' reference in addContractsFormulaColumns`);
  ws.getCell(`C${r}`).value = fxRate;
  r += 2;

  ws.getCell(`B${r}`).value = '🎯 KPI';
  ws.getCell(`B${r}`).font = { bold: true };
  r += 1;
  ws.getCell(`B${r}`).value = { formula: `IFERROR(INDEX(KPI!$B$2:$B$${kLast},MATCH(MAX(KPI!$B$2:$B$${kLast}),KPI!$B$2:$B$${kLast},0))&"년","-")` };
  ws.getCell(`D${r}`).value = { formula: `IF(IFERROR(INDEX(KPI!$C$2:$C$${kLast},MATCH(MAX(KPI!$B$2:$B$${kLast}),KPI!$B$2:$B$${kLast},0)),"")="","메모 없음",INDEX(KPI!$C$2:$C$${kLast},MATCH(MAX(KPI!$B$2:$B$${kLast}),KPI!$B$2:$B$${kLast},0)))` };
  r += 2;

  ws.getCell(`B${r}`).value = '📊 핵심 지표';
  ws.getCell(`B${r}`).font = { bold: true };
  r += 1;
  [['B', 'Active 계약'], ['D', 'Active 총 BW(Gbps)'], ['F', 'Lease MRC(억원/월)'], ['H', '누적 매출(억원)']]
    .forEach(([col, label]) => { ws.getCell(`${col}${r}`).value = label; ws.getCell(`${col}${r}`).font = { bold: true }; });
  r += 1;
  ws.getCell(`B${r}`).value = { formula: `COUNTIF(Contracts!$R$2:$R$${cLast},"Active")` };
  ws.getCell(`D${r}`).value = { formula: `SUMIF(Contracts!$R$2:$R$${cLast},"Active",Contracts!$U$2:$U$${cLast})` };
  const leaseMrcFormula = `SUMIFS(Contracts!$W$2:$W$${cLast},Contracts!$R$2:$R$${cLast},"Active",Contracts!$D$2:$D$${cLast},"Lease")*$C$${fxRow}/100000000`;
  ws.getCell(`F${r}`).value = { formula: leaseMrcFormula };
  const cumulativeRevenueFormula = `SUM(Contracts!$Z$2:$Z$${cLast})*$C$${fxRow}/100000000`;
  ws.getCell(`H${r}`).value = { formula: cumulativeRevenueFormula };
  r += 2;

  ws.getCell(`B${r}`).value = '🌊 Segment S 사용률 (Design 대비 Sold, %)';
  ws.getCell(`B${r}`).font = { bold: true };
  ws.getCell(`D${r}`).value = {
    formula: `IFERROR(ROUND(SUMIF(Contracts!$R$2:$R$${cLast},"Active",Contracts!$U$2:$U$${cLast})/SUMIF(CapacityDesign!$B$2:$B$${capLast},"S",CapacityDesign!$E$2:$E$${capLast})*100,0),0)`,
  };
  r += 2;

  r = writeSegmentTable(ws, r, '🌊 Segment S 상세 (Gbps)', segmentSRows.map((s) => ({ segmentId: s.segment_id, label: s.segment_label, capLast })), { cLast, lLast, isSegmentS: true });
  r += 1;
  r = writeSegmentTable(ws, r, '🛣️ Segment L 상세 (Gbps)', segmentLRows.map((s) => ({ segmentId: s.segment_id, label: s.segment_label, flagCol: s.flagCol, capLast })), { cLast, lLast, isSegmentS: false });
  r += 1;

  ws.getCell(`B${r}`).value = '💰 매출 요약 / 🔽 Funnel / ⚡ Lightup 현황';
  ws.getCell(`B${r}`).font = { bold: true, size: 12 };
  r += 1;
  ws.getCell(`B${r}`).value = '매출 요약'; ws.getCell(`B${r}`).font = { bold: true };
  ws.getCell(`E${r}`).value = 'Stage'; ws.getCell(`F${r}`).value = '건수'; ws.getCell(`G${r}`).value = 'BW(Gbps)';
  ws.getCell(`I${r}`).value = 'Status'; ws.getCell(`J${r}`).value = 'Qty(Gbps)'; ws.getCell(`K${r}`).value = 'Est. Cost($)';
  ['E', 'F', 'G', 'I', 'J', 'K'].forEach((c) => { ws.getCell(`${c}${r}`).font = { bold: true }; });
  r += 1;

  const revenueRows = [
    { label: 'Lease MRC(억원/월)', formula: leaseMrcFormula, funnelStage: 'Prospect', lightupStatus: '설치완료' },
    { label: 'Lease ARR(억원/년)', formula: null, funnelStage: 'Negotiation', lightupStatus: '구축중' },
    { label: 'IRU OTC(억원)', formula: `SUMIFS(Contracts!$AA$2:$AA$${cLast},Contracts!$R$2:$R$${cLast},"Active",Contracts!$D$2:$D$${cLast},"IRU")*$C$${fxRow}/100000000`, funnelStage: 'Signed', lightupStatus: '계획중' },
    { label: 'IRU 연O&M(억원)', formula: `SUMIFS(Contracts!$AB$2:$AB$${cLast},Contracts!$R$2:$R$${cLast},"Active",Contracts!$D$2:$D$${cLast},"IRU")*$C$${fxRow}/100000000`, funnelStage: 'Active', lightupStatus: null },
    { label: '누적 매출(억원)', formula: cumulativeRevenueFormula, funnelStage: null, lightupStatus: null },
  ];
  const leaseMrcCellRow = r;
  revenueRows.forEach((row, i) => {
    const thisRow = r + i;
    ws.getCell(`B${thisRow}`).value = row.label;
    ws.getCell(`D${thisRow}`).value = { formula: row.formula ?? `D${leaseMrcCellRow}*12` };
    if (row.funnelStage) {
      ws.getCell(`E${thisRow}`).value = row.funnelStage;
      ws.getCell(`F${thisRow}`).value = { formula: `COUNTIF(Funnel!$H$2:$H$${fLast},"${row.funnelStage}")` };
      ws.getCell(`G${thisRow}`).value = { formula: `SUMIF(Funnel!$H$2:$H$${fLast},"${row.funnelStage}",Funnel!$L$2:$L$${fLast})` };
    }
    if (row.lightupStatus) {
      ws.getCell(`I${thisRow}`).value = row.lightupStatus;
      ws.getCell(`J${thisRow}`).value = { formula: `SUMIF(Lightup!$H$2:$H$${lLast},"${row.lightupStatus}",Lightup!$E$2:$E$${lLast})+SUMIF(Lightup!$H$2:$H$${lLast},"${row.lightupStatus}",Lightup!$F$2:$F$${lLast})` };
      ws.getCell(`K${thisRow}`).value = { formula: `SUMIF(Lightup!$H$2:$H$${lLast},"${row.lightupStatus}",Lightup!$K$2:$K$${lLast})` };
    }
  });
  r += revenueRows.length + 1;

  ws.getCell(`B${r}`).value = '📅 연도별 매출(억원) & 계약 Bandwidth(Gbps)';
  ws.getCell(`B${r}`).font = { bold: true, size: 12 };
  r += 1;
  ws.getCell(`B${r}`).value = '* 매출은 계약 시작일~종료일 기준 월별 비례인식, BW는 그 해 신규 계약 기준';
  r += 1;
  ['연도', 'Lease 매출', 'IRU OTC', 'IRU O&M', '총 매출', '계약 BW(Gbps)', '신규 계약 건수']
    .forEach((h, i) => { const cell = ws.getCell(r, 2 + i); cell.value = h; cell.font = { bold: true }; });
  r += 1;
  const yearFirstRow = r;
  for (let year = YEAR_FROM; year <= YEAR_TO; year++) {
    const overlap = overlapMonthsExpr(cLast, year);
    ws.getCell(`B${r}`).value = year;
    ws.getCell(`C${r}`).value = { formula: `SUMPRODUCT((Contracts!$D$2:$D$${cLast}="Lease")*(${overlap})*Contracts!$W$2:$W$${cLast})*$C$${fxRow}/100000000` };
    ws.getCell(`D${r}`).value = { formula: `SUMPRODUCT((${overlap})*Contracts!$X$2:$X$${cLast})*$C$${fxRow}/100000000` };
    ws.getCell(`E${r}`).value = { formula: `SUMPRODUCT((${overlap})*Contracts!$Y$2:$Y$${cLast})*$C$${fxRow}/100000000` };
    ws.getCell(`F${r}`).value = { formula: `C${r}+D${r}+E${r}` };
    ws.getCell(`G${r}`).value = { formula: `SUMIFS(Contracts!$U$2:$U$${cLast},Contracts!$O$2:$O$${cLast},${year})` };
    ws.getCell(`H${r}`).value = { formula: `COUNTIFS(Contracts!$O$2:$O$${cLast},${year})` };
    r += 1;
  }
  const yearLastRow = r - 1;
  ws.getCell(`B${r}`).value = 'TOTAL';
  ws.getCell(`B${r}`).font = { bold: true };
  for (const col of ['C', 'D', 'E', 'F', 'G', 'H']) {
    ws.getCell(`${col}${r}`).value = { formula: `SUM(${col}${yearFirstRow}:${col}${yearLastRow})` };
    ws.getCell(`${col}${r}`).font = { bold: true };
  }

  // Dashboard is created after the data sheets (it needs their row counts) but should
  // still appear as the first tab, matching the original workbook.
  ws.orderNo = 0;
  return ws;
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SJC2 Capacity Schedule';
  wb.created = new Date();

  const fxRate = await getFxRate();
  const rowCounts = {};
  let capacityDesignRows = [];

  for (const def of TABLE_DEFS) {
    const rows = await db.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.orderBy}`).all();
    rowCounts[def.table] = rows.length;
    if (def.table === 'capacity_design') capacityDesignRows = rows;

    const ws = wb.addWorksheet(def.sheet);
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      ...def.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 2) })),
    ];
    styleHeaderRow(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const dateColumns = def.columns.filter((c) => c.date);
    for (const r of rows) {
      const rowObj = { id: r.id };
      for (const c of def.columns) rowObj[c.key] = cellForExport(c, r[c.key]);
      const newRow = ws.addRow(rowObj);
      for (const c of dateColumns) {
        const cell = newRow.getCell(c.key);
        if (cell.value) cell.numFmt = 'yyyy-mm-dd';
      }
    }

    const lastRow = 1 + rows.length;
    if (def.table === 'contracts') addContractsFormulaColumns(ws, lastRow);
    if (def.table === 'funnel') addFunnelFormulaColumn(ws, lastRow);
    if (def.table === 'lightup_schedule') addLightupFormulaColumn(ws, lastRow);
  }

  const segmentSRows = capacityDesignRows.filter((r) => r.seg_type === 'S');
  const segmentLRows = SEGMENT_L_DEFS
    .map((def) => {
      const row = capacityDesignRows.find((r) => r.segment_id === def.segmentId);
      return row ? { segment_id: row.segment_id, segment_label: row.segment_label, flagCol: def.flagCol } : null;
    })
    .filter(Boolean);

  addDashboardSheet(wb, {
    fxRate,
    cLast: 1 + rowCounts.contracts,
    fLast: 1 + rowCounts.funnel,
    lLast: 1 + rowCounts.lightup_schedule,
    kLast: 1 + rowCounts.kpis,
    capLast: 1 + rowCounts.capacity_design,
    segmentSRows,
    segmentLRows,
  });

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
