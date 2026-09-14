import express from 'express';
import cors from 'cors';
import { makeCrudRouter } from './routes/genericCrud.js';
import contractsRouter from './routes/contracts.js';
import dashboardRouter from './routes/dashboard.js';
import revenueRouter from './routes/revenue.js';
import settingsRouter from './routes/settings.js';
import logRouter from './routes/log.js';
import authRouter from './routes/auth.js';
import cablesRouter from './routes/cables.js';
import chatbotRouter from './routes/chatbot.js';
import { requireAuth } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

// Everything registered below requires a logged-in session (viewer or admin).
app.use('/api', requireAuth);

app.use('/api/capacity-design', makeCrudRouter({
  table: 'capacity_design',
  columns: ['seg_type', 'segment_id', 'segment_label', 'design_capacity_gbps', 'sort_order'],
  orderBy: 'sort_order, id',
  describe: (r) => `${r.segment_label} (${r.segment_id}) = ${r.design_capacity_gbps} Gbps`,
}));

app.use('/api/capacity-phase', makeCrudRouter({
  table: 'capacity_phase',
  columns: ['segment_label', 'current_tbps', 'phase1_tbps', 'phase2_tbps', 'phase3_tbps', 'phase4_tbps', 'sort_order'],
  orderBy: 'sort_order, id',
  describe: (r) => `${r.segment_label} 단계별 용량 갱신`,
}));

app.use('/api/lightup', makeCrudRouter({
  table: 'lightup_schedule',
  columns: ['schedule', 'seg_type', 'segment_id', 'if100g', 'if400g', 'unit_price', 'status', 'complete_date', 'note'],
  describe: (r) => `${r.segment_id} ${r.schedule} 상태 ${r.status}`,
}));

app.use('/api/funnel', makeCrudRouter({
  table: 'funnel',
  columns: ['no', 'customer', 'a_end', 'z_end', 'if100g', 'if400g', 'stage', 'priority', 'target_date', 'note'],
  describe: (r) => `${r.customer} ${r.a_end}→${r.z_end} (${r.stage})`,
}));

app.use('/api/kpis', makeCrudRouter({
  table: 'kpis',
  columns: ['year', 'memo'],
  orderBy: 'year',
  describe: (r) => `${r.year}년 KPI 메모: ${r.memo || ''}`,
}));

app.use('/api/internal-demand-s', makeCrudRouter({
  table: 'internal_demand_s',
  columns: ['dls_code', 'segment_label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'sort_order'],
  orderBy: 'sort_order, id',
  describe: (r) => `내부수요 Segment S: ${r.segment_label}`,
}));

app.use('/api/internal-demand-l', makeCrudRouter({
  table: 'internal_demand_l',
  columns: ['pop', 'segment_label', 'h1', 'h2', 'h3', 'h4', 'h5', 'sort_order'],
  orderBy: 'sort_order, id',
  describe: (r) => `내부수요 Segment L: ${r.segment_label}`,
}));

app.use('/api/contracts', contractsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/revenue', revenueRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/log', logRouter);
app.use('/api/cables', cablesRouter);
app.use('/api/chatbot', chatbotRouter);

export default app;
