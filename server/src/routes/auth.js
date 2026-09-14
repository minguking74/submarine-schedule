import { Router } from 'express';
import { db } from '../db.js';
import { signToken, requireAuth, requireAdmin } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: '이름을 입력해 주세요' });

  let role = null;
  if (password && password === process.env.ADMIN_PASSWORD) role = 'admin';
  else if (password && password === process.env.VIEWER_PASSWORD) role = 'viewer';

  if (!role) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });

  await db.prepare(`INSERT INTO login_log (name, role, user_agent) VALUES (?, ?, ?)`)
    .run(name, role, req.headers['user-agent'] || null);

  const token = signToken({ name, role });
  res.json({ token, name, role });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ name: req.user.name, role: req.user.role });
});

router.get('/login-log', requireAuth, requireAdmin, async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM login_log ORDER BY id DESC LIMIT 300`).all();
  res.json(rows);
});

export default router;
