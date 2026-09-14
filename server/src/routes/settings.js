import { Router } from 'express';
import { getFxRate, setFxRate, logActivity } from '../calc.js';
import { requireAdmin } from '../auth.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json({ fx_rate: await getFxRate() });
});

router.put('/', requireAdmin, async (req, res) => {
  const { fx_rate } = req.body;
  if (fx_rate !== undefined) {
    const prev = await getFxRate();
    await setFxRate(Number(fx_rate));
    await logActivity(`[settings] 원/달러 기준환율 변경: ${prev} → ${fx_rate}`);
  }
  res.json({ fx_rate: await getFxRate() });
});

export default router;
