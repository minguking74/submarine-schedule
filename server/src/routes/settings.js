import { Router } from 'express';
import { getFxRate, setFxRate, logActivity } from '../calc.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ fx_rate: getFxRate() });
});

router.put('/', (req, res) => {
  const { fx_rate } = req.body;
  if (fx_rate !== undefined) {
    const prev = getFxRate();
    setFxRate(Number(fx_rate));
    logActivity(`[settings] 원/달러 기준환율 변경: ${prev} → ${fx_rate}`);
  }
  res.json({ fx_rate: getFxRate() });
});

export default router;
