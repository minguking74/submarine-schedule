import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { logActivity } from '../calc.js';

const router = Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM cables ORDER BY sort_order, id`).all();
  res.json(rows);
});

router.get('/:key', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM cables WHERE cable_key = ?`).get(req.params.key);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.put('/:key', requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM cables WHERE cable_key = ?`).get(req.params.key);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const payload = {
    key: req.params.key,
    service_year: req.body.service_year ?? existing.service_year,
    status: req.body.status ?? existing.status,
    summary: req.body.summary ?? existing.summary,
    details: req.body.details ?? existing.details,
  };
  await db.prepare(`
    UPDATE cables SET service_year = @service_year, status = @status, summary = @summary, details = @details
    WHERE cable_key = @key
  `).run(payload);
  const row = await db.prepare(`SELECT * FROM cables WHERE cable_key = ?`).get(req.params.key);
  await logActivity(`[cables] ${row.name} 개요 수정`);
  res.json(row);
});

export default router;
