const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const {
  SCORING_CONFIG,
  buildPrompt
} = require('../services/scoring');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-TESTING1234567890KEYDONOTSHARE',
});

const dashboardSql = `SELECT c.id, c.company_name, c.plan, c.csm_email, h.score, h.risk_level,
  h.insight, h.next_step, h.updated_at, COALESCE(s.usage_drop, 0)::float usage_drop,
  COALESCE(s.open_tickets, 0)::int open_tickets, COALESCE(s.sentiment, 'neutral') sentiment,
  COALESCE(s.days_inactive, 0)::int days_inactive, COALESCE(s.renewal_days, 180)::int renewal_days
  FROM customers c
  JOIN customer_health h ON h.customer_id = c.id
  LEFT JOIN LATERAL (
    SELECT usage_drop, open_tickets, sentiment, days_inactive, renewal_days
    FROM customer_signals
    WHERE customer_id = c.id
    ORDER BY observed_at DESC
    LIMIT 1
  ) s ON true`;

// ==============================
// Scoring Configuration Endpoint
// ==============================
router.get('/config/scoring', (_req, res) => {
  res.json(SCORING_CONFIG);
});

router.post('/ingest', (req, res) => {
  const input = req.body || {};

  if (!input.customerId) {
    console.error("Missing customerId");

    return res.status(400).json({
      success: false,
      message: "customerId is required"
    });
  }

  const normalizedData = {
    customerId: Number(input.customerId) || 0,
    source: String(input.source || "manual"),

    usageDrop: Number(input.usageDrop ?? input.usage_drop ?? 0),

    openTickets: Number(input.openTickets ?? input.open_tickets ?? 0),

    sentiment: String(
      input.sentiment ?? "neutral"
    ).toLowerCase(),

    daysInactive: Number(
      input.daysInactive ?? input.days_inactive ?? 0
    ),

    renewalDays: Number(
      input.renewalDays ?? input.renewal_days ?? 180
    ),

    note: String(input.note || "").trim()
  };

  if (
    isNaN(normalizedData.usageDrop) ||
    isNaN(normalizedData.openTickets) ||
    isNaN(normalizedData.daysInactive) ||
    isNaN(normalizedData.renewalDays)
  ) {
    console.error("Malformed numeric fields");

    normalizedData.usageDrop = 0;
    normalizedData.openTickets = 0;
    normalizedData.daysInactive = 0;
    normalizedData.renewalDays = 180;
  }

  res.json({
    success: true,
    message: "Customer health signal normalized successfully.",
    data: normalizedData
  });
});

// ==============================
// AI Alerts Endpoint
// ==============================
router.get('/alerts', async (_req, res, next) => {
  try {
    const result = await query(
      `${dashboardSql} WHERE h.risk_level IN ('high', 'medium') ORDER BY h.score ASC`
    );

    const alertsWithAI = await Promise.all(
      result.rows.map(async (customer) => {

        const generatedPrompt = buildPrompt({
          companyName: customer.company_name,
          score: customer.score,
          riskLevel: customer.risk_level,
          usageDrop: customer.usage_drop,
          openTickets: customer.open_tickets,
          sentiment: customer.sentiment,
          daysInactive: customer.days_inactive,
          renewalDays: customer.renewal_days
        });

        let aiResponseText = '';

        try {
          const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: generatedPrompt
              }
            ],
            temperature: 0.7
          });

          aiResponseText = completion.choices[0].message.content;

        } catch (openAiError) {

          aiResponseText =
            `AI Insight: Client ${customer.company_name} shows risk factors. Schedule review.`;

        }

        return {
          customerId: customer.id,
          companyName: customer.company_name,
          riskLevel: customer.risk_level,
          score: customer.score,
          staticInsight: customer.insight,
          staticNextStep: customer.next_step,
          aiAnalysis: aiResponseText,
          scoringParameters: SCORING_CONFIG,
          csmEmail: customer.csm_email
        };

      })
    );

    res.json(alertsWithAI);

  } catch (error) {
    next(error);
  }
});

module.exports = router;