const router = require('express').Router();
const { query } = require('../config/db');
const {
  getHealthScore,
  getRecommendation,
  buildPrompt
} = require('../services/scoring');

const dashboardSql = `SELECT c.id, c.company_name, c.plan, c.csm_email, h.score, h.risk_level,
  h.insight, h.next_step, h.updated_at, COALESCE(s.usage_drop, 0)::float usage_drop,
  COALESCE(s.open_tickets, 0)::int open_tickets, COALESCE(s.sentiment, 'neutral') sentiment,
  COALESCE(s.days_inactive, 0)::int days_inactive, COALESCE(s.renewal_days, 180)::int renewal_days
  FROM customers c JOIN customer_health h ON h.customer_id = c.id
  LEFT JOIN LATERAL (SELECT usage_drop, open_tickets, sentiment, days_inactive, renewal_days
    FROM customer_signals WHERE customer_id = c.id ORDER BY observed_at DESC LIMIT 1) s ON true`;

const parseNumber = (value, field, min = 0, max = 10000) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw Object.assign(new Error(`${field} must be between ${min} and ${max}.`), { status: 400 });
  return number;
};

async function customerExists(id) {
  return (await query('SELECT id FROM customers WHERE id = $1', [id])).rowCount > 0;
}

async function recordSignal(input) {
  const customerId = parseNumber(input.customerId, 'customerId', 1, Number.MAX_SAFE_INTEGER);
  if (!(await customerExists(customerId))) throw Object.assign(new Error('Customer not found.'), { status: 404 });
  const source = String(input.source || '').trim();
  if (!['product_analytics', 'airtable_crm', 'support_email', 'manual'].includes(source)) throw Object.assign(new Error('source must be product_analytics, airtable_crm, support_email, or manual.'), { status: 400 });
  const sentiment = String(input.sentiment || 'neutral').toLowerCase();
  if (!['positive', 'neutral', 'negative'].includes(sentiment)) throw Object.assign(new Error('sentiment must be positive, neutral, or negative.'), { status: 400 });
  const signal = {
    customerId, source, sentiment,
    usageDrop: parseNumber(input.usageDrop || 0, 'usageDrop', 0, 100),
    openTickets: parseNumber(input.openTickets || 0, 'openTickets', 0, 1000),
    daysInactive: parseNumber(input.daysInactive || 0, 'daysInactive', 0, 3650),
    renewalDays: parseNumber(input.renewalDays ?? 180, 'renewalDays', 0, 3650),
    note: String(input.note || '').trim().slice(0, 2000)
  };
  const { score, riskLevel } = getHealthScore(signal);
  const { insight, nextStep } = getRecommendation(signal);
  await query(`INSERT INTO customer_signals (customer_id, source, usage_drop, open_tickets, sentiment, days_inactive, renewal_days, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [signal.customerId, signal.source, signal.usageDrop, signal.openTickets, signal.sentiment, signal.daysInactive, signal.renewalDays, signal.note]);
  await query(`INSERT INTO customer_health (customer_id, score, risk_level, insight, next_step, updated_at)
    VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (customer_id) DO UPDATE
    SET score = EXCLUDED.score, risk_level = EXCLUDED.risk_level, insight = EXCLUDED.insight,
      next_step = EXCLUDED.next_step, updated_at = NOW()`, [signal.customerId, score, riskLevel, insight, nextStep]);
  return { customerId: signal.customerId, score, riskLevel, insight, nextStep };
}

router.get('/', (_req, res) => res.json({ name: 'RetainIQ Churn Intelligence API', version: '1.0.0', docs: '/api/docs' }));
router.get('/docs', (_req, res) => res.json({
  endpoints: ['GET /api/dashboard', 'GET /api/customers?risk=high', 'GET /api/customers/:id', 'POST /api/customers', 'PATCH /api/customers/:id', 'GET /api/customers/:id/signals', 'POST /api/signals', 'POST /api/signals/bulk', 'GET /api/alerts']
}));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [customers, summary] = await Promise.all([query(`${dashboardSql} ORDER BY h.score ASC`), query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE risk_level = 'high')::int high_risk, COUNT(*) FILTER (WHERE risk_level = 'medium')::int medium_risk, COUNT(*) FILTER (WHERE risk_level = 'low')::int low_risk, COALESCE(ROUND(AVG(score)), 0)::int average_health FROM customer_health`)]);
    res.json({ summary: summary.rows[0], customers: customers.rows });
  } catch (error) { next(error); }
});

router.get('/customers', async (req, res, next) => {
  try {
    const risk = req.query.risk;
    if (risk && !['low', 'medium', 'high'].includes(risk)) throw Object.assign(new Error('risk must be low, medium, or high.'), { status: 400 });
    const suffix = risk ? ' WHERE h.risk_level = $1 ORDER BY h.score ASC' : ' ORDER BY h.score ASC';
    const result = await query(`${dashboardSql}${suffix}`, risk ? [risk] : []);
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get('/customers/:id', async (req, res, next) => {
  try { const result = await query(`${dashboardSql} WHERE c.id = $1`, [req.params.id]); if (!result.rowCount) throw Object.assign(new Error('Customer not found.'), { status: 404 }); res.json(result.rows[0]); } catch (error) { next(error); }
});

router.post('/customers', async (req, res, next) => {
  try {
    const { companyName, plan, csmEmail } = req.body;
    if (![companyName, plan, csmEmail].every(value => typeof value === 'string' && value.trim())) throw Object.assign(new Error('companyName, plan, and csmEmail are required.'), { status: 400 });
    const created = await query('INSERT INTO customers (company_name, plan, csm_email) VALUES ($1,$2,$3) RETURNING *', [companyName.trim(), plan.trim(), csmEmail.trim().toLowerCase()]);
    await query(`INSERT INTO customer_health (customer_id, score, risk_level, insight, next_step) VALUES ($1, 100, 'low', 'Awaiting first customer signal.', 'Collect product, CRM, and support data.')`, [created.rows[0].id]);
    res.status(201).json(created.rows[0]);
  } catch (error) { next(error); }
});

router.patch('/customers/:id', async (req, res, next) => {
  try {
    const allowed = { companyName: 'company_name', plan: 'plan', csmEmail: 'csm_email' };
    const fields = Object.entries(req.body).filter(([key, value]) => allowed[key] && typeof value === 'string' && value.trim());
    if (!fields.length) throw Object.assign(new Error('Provide companyName, plan, or csmEmail.'), { status: 400 });
    const updates = fields.map(([key], index) => `${allowed[key]} = $${index + 1}`).join(', ');
    const values = fields.map(([, value]) => value.trim()); values.push(req.params.id);
    const result = await query(`UPDATE customers SET ${updates} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rowCount) throw Object.assign(new Error('Customer not found.'), { status: 404 });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

router.get('/customers/:id/signals', async (req, res, next) => {
  try { if (!(await customerExists(req.params.id))) throw Object.assign(new Error('Customer not found.'), { status: 404 }); const result = await query('SELECT * FROM customer_signals WHERE customer_id = $1 ORDER BY observed_at DESC LIMIT 50', [req.params.id]); res.json(result.rows); } catch (error) { next(error); }
});

router.post('/signals', async (req, res, next) => { try { res.status(201).json(await recordSignal(req.body)); } catch (error) { next(error); } });
router.post('/signals/bulk', async (req, res, next) => {
  try { if (!Array.isArray(req.body.signals) || !req.body.signals.length || req.body.signals.length > 100) throw Object.assign(new Error('signals must contain 1 to 100 items.'), { status: 400 }); const results = []; for (const signal of req.body.signals) results.push(await recordSignal(signal)); res.status(201).json({ processed: results.length, results }); } catch (error) { next(error); }
});
rrouter.get('/alerts', async (_req, res, next) => {
  try {
    const result = await query(
      `${dashboardSql} WHERE h.risk_level IN ('high', 'medium') ORDER BY h.score ASC`
    );

    res.json(
      result.rows.map(customer => ({
        customerId: customer.id,
        companyName: customer.company_name,
        riskLevel: customer.risk_level,
        score: customer.score,
        insight: customer.insight,
        nextStep: customer.next_step,
        aiPrompt: buildPrompt({
          usageDrop: customer.usage_drop,
          openTickets: customer.open_tickets,
          sentiment: customer.sentiment,
          daysInactive: customer.days_inactive,
          renewalDays: customer.renewal_days
        }),
        csmEmail: customer.csm_email
      }))
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
