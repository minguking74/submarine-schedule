import { Router } from 'express';
import { db } from '../db.js';
import { enrichContract, getFxRate, logActivity } from '../calc.js';
import { requireAdmin } from '../auth.js';

const COLUMNS = [
  'no', 'customer', 'contract_type', 'segment_s', 'segment_l', 'a_end', 'z_end',
  'if100g', 'if400g', 'currency', 'mrc', 'otc', 'om_annual', 'contract_year',
  'duration_months', 'start_date', 'status', 'cc_flag', 'am',
];

const router = Router();

router.get('/', async (req, res) => {
  const rate = await getFxRate();
  const rows = await db.prepare(`SELECT * FROM contracts ORDER BY id`).all();
  res.json(rows.map((r) => enrichContract(r, rate)));
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(enrichContract(row, await getFxRate()));
});

router.post('/', requireAdmin, async (req, res) => {
  const payload = Object.fromEntries(COLUMNS.map((c) => [c, req.body[c] ?? null]));
  const info = await db.prepare(`
    INSERT INTO contracts (${COLUMNS.join(', ')})
    VALUES (${COLUMNS.map((c) => `@${c}`).join(', ')})
    RETURNING id
  `).run(payload);
  const row = await db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(info.lastInsertRowid);
  await logActivity(`[contracts] 계약 추가: ${row.customer} (${row.segment_s || row.segment_l || ''})`);
  res.status(201).json(enrichContract(row, await getFxRate()));
});

router.put('/:id', requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const payload = Object.fromEntries(COLUMNS.map((c) => [c, req.body[c] ?? existing[c]]));
  payload.id = req.params.id;
  await db.prepare(`
    UPDATE contracts SET ${COLUMNS.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id
  `).run(payload);
  const row = await db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(req.params.id);

  const changes = [];
  for (const c of COLUMNS) {
    if (String(existing[c] ?? '') !== String(row[c] ?? '')) {
      changes.push(`${c}: ${existing[c]} → ${row[c]}`);
    }
  }
  await logActivity(`[contracts] 계약 수정 (${row.customer}): ${changes.join(', ') || '변경 없음'}`);
  res.json(enrichContract(row, await getFxRate()));
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await db.prepare(`DELETE FROM contracts WHERE id = ?`).run(req.params.id);
  await logActivity(`[contracts] 계약 삭제: ${existing.customer} (${existing.segment_s || existing.segment_l || ''})`);
  res.status(204).end();
});

export default router;
