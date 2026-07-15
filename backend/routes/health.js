const router = require('express').Router();
const { query } = require('../config/db');

const customersSql = `SELECT c.id, c.company_name, c.plan, c.csm_email, h.score, h.risk_level,
  h.insight, h.next_step, h.updated_at, COALESCE(s.usage_drop, 0) usage_drop,
  COALESCE(s.open_tickets, 0) open_tickets
  FROM customers c JOIN customer_health h ON h.customer_id = c.id
  LEFT JOIN LATERAL (SELECT usage_drop, open_tickets FROM customer_signals
    WHERE customer_id = c.id ORDER BY observed_at DESC LIMIT 1) s ON true
  ORDER BY h.score ASC`;

router.get('/customers', async (_req, res, next) => {
  try { res.json((await query(customersSql)).rows); } catch (error) { next(error); }
});

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [customers, summary] = await Promise.all([
      query(customersSql),
      query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE risk_level = 'high')::int high_risk,
        COUNT(*) FILTER (WHERE risk_level = 'medium')::int medium_risk,
        ROUND(AVG(score))::int average_health FROM customer_health`)
    ]);
    res.json({ summary: summary.rows[0], customers: customers.rows });
  } catch (error) { next(error); }
});

// n8n sends normalized product, CRM, or support data here.
router.post('/signals', async (req, res, next) => {
  const { customerId, source, usageDrop = 0, openTickets = 0, sentiment = 'neutral', note = '' } = req.body;
  if (!customerId || !source) return res.status(400).json({ error: 'customerId and source are required.' });
  const score = Math.max(0, Math.min(100, 100 - Number(usageDrop) - Number(openTickets) * 6 - (sentiment === 'negative' ? 18 : 0)));
  const risk = score < 50 ? 'high' : score < 75 ? 'medium' : 'low';
  try {
    await query('INSERT INTO customer_signals (customer_id, source, usage_drop, open_tickets, sentiment, note) VALUES ($1,$2,$3,$4,$5,$6)', [customerId, source, usageDrop, openTickets, sentiment, note]);
    const insight = usageDrop > 20 ? `Product usage fell ${usageDrop}% in the latest period.` : 'No material product-usage decline detected.';
    await query(`INSERT INTO customer_health (customer_id, score, risk_level, insight, next_step, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (customer_id) DO UPDATE SET score=$2, risk_level=$3, insight=$4, next_step=$5, updated_at=NOW()`,
      [customerId, score, risk, insight, risk === 'high' ? 'Schedule a recovery call within 24 hours.' : 'Review account in the next CSM check-in.']);
    res.status(201).json({ customerId, score, riskLevel: risk });
  } catch (error) { next(error); }
});

module.exports = router;
