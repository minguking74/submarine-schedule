import { Router } from 'express';
import { db } from '../db.js';
import { logActivity } from '../calc.js';

/**
 * Builds a simple REST CRUD router for a table with a fixed set of editable columns.
 * `describe(row)` produces a human-readable summary used for the activity log.
 */
export function makeCrudRouter({ table, columns, orderBy = 'id', describe }) {
  const router = Router();
  const cols = columns.join(', ');
  const placeholders = columns.map((c) => `@${c}`).join(', ');
  const setClause = columns.map((c) => `${c} = @${c}`).join(', ');

  router.get('/', (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  router.post('/', (req, res) => {
    const payload = Object.fromEntries(columns.map((c) => [c, req.body[c] ?? null]));
    const info = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).run(payload);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    if (describe) logActivity(`[${table}] 추가: ${describe(row)}`);
    res.status(201).json(row);
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const payload = Object.fromEntries(columns.map((c) => [c, req.body[c] ?? existing[c]]));
    payload.id = req.params.id;
    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = @id`).run(payload);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (describe) logActivity(`[${table}] 수정: ${describe(row)}`);
    res.json(row);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    if (describe) logActivity(`[${table}] 삭제: ${describe(existing)}`);
    res.status(204).end();
  });

  return router;
}
