import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const limit = Number(req.query.limit) || 200;
  const rows = await db.prepare(`SELECT * FROM activity_log ORDER BY id DESC LIMIT ?`).all(limit);
  res.json(rows);
});

export default router;
