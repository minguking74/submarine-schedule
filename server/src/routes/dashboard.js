import { Router } from 'express';
import { buildDashboard } from '../dashboard.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await buildDashboard());
});

export default router;
