import { Router } from 'express';
import { db } from '../db.js';
import { logActivity } from '../calc.js';
import { requireAdmin } from '../auth.js';

/**
 * Builds a simple REST CRUD router for a table with a fixed set of editable columns.
 * `describe(row)` produces a human-readable summary used for the activity log.
 */
export function makeCrudRouter({ table, columns, orderBy = 'id', describe }) {
  const router = Router();
  const cols = columns.join(', ');
  const placeholders = columns.map((c) => `@${c}`).join(', ');
  const setClause = columns.map((c) => `${c} = @${c}`).join(', ');

  router.get('/', async (req, res) => {
    const rows = await db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
    res.json(rows);
  });

  router.get('/:id', async (req, res) => {
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  router.post('/', requireAdmin, async (req, res) => {
    const payload = Object.fromEntries(columns.map((c) => [c, req.body[c] ?? null]));
    const info = await db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING id`).run(payload);
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    if (describe) await logActivity(`[${table}] 추가: ${describe(row)}`);
    res.status(201).json(row);
  });

  router.put('/:id', requireAdmin, async (req, res) => {
    const existing = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const payload = Object.fromEntries(columns.map((c) => [c, req.body[c] ?? existing[c]]));
    payload.id = req.params.id;
    await db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = @id`).run(payload);
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (describe) await logActivity(`[${table}] 수정: ${describe(row)}`);
    res.json(row);
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const existing = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    if (describe) await logActivity(`[${table}] 삭제: ${describe(existing)}`);
    res.status(204).end();
  });

  return router;
}
