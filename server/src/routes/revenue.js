import { Router } from 'express';
import { buildRevenueMonthly, buildRevenueYearly } from '../calc.js';

const router = Router();

router.get('/monthly', (req, res) => {
  const from = Number(req.query.from) || 2023;
  const to = Number(req.query.to) || 2032;
  res.json(buildRevenueMonthly(from, to));
});

router.get('/yearly', (req, res) => {
  const from = Number(req.query.from) || 2023;
  const to = Number(req.query.to) || 2028;
  res.json(buildRevenueYearly(from, to));
});

export default router;
