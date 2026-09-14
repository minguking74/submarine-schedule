import { Router } from 'express';
import { buildDashboard } from '../dashboard.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(buildDashboard());
});

export default router;
