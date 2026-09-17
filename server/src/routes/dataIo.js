import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { logActivity } from '../calc.js';
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
  if (rawValue instanceof Date) return rawValue.toISOString().slice(0, 10);
  return String(rawValue);
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
