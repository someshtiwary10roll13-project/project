CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, plan TEXT NOT NULL, csm_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_signals (
  id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('product_analytics', 'airtable_crm', 'support_email', 'manual')),
  usage_drop NUMERIC NOT NULL DEFAULT 0 CHECK (usage_drop BETWEEN 0 AND 100), open_tickets INTEGER NOT NULL DEFAULT 0 CHECK (open_tickets >= 0),
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  days_inactive INTEGER NOT NULL DEFAULT 0 CHECK (days_inactive >= 0), renewal_days INTEGER NOT NULL DEFAULT 180 CHECK (renewal_days >= 0),
  note TEXT, observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_health (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE, score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')), insight TEXT NOT NULL, next_step TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS signals_customer_observed_idx ON customer_signals (customer_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS health_risk_score_idx ON customer_health (risk_level, score);

INSERT INTO customers (company_name, plan, csm_email) VALUES
 ('Acme Labs', 'Enterprise', 'maya@company.test'), ('Northstar Inc.', 'Growth', 'maya@company.test'), ('Bloom & Co.', 'Pro', 'liam@company.test'), ('Vertex Systems', 'Enterprise', 'liam@company.test') ON CONFLICT DO NOTHING;
INSERT INTO customer_health (customer_id, score, risk_level, insight, next_step) VALUES
 (1, 38, 'high', 'Weekly active users fell 42% and two priority tickets remain unresolved.', 'Book an executive recovery call today.'),
 (2, 62, 'medium', 'Product adoption is down 18% after the latest release.', 'Share the onboarding refresher with the admin.'),
 (3, 84, 'low', 'Usage and support activity are stable.', 'Continue the regular success cadence.'),
 (4, 48, 'high', 'Negative support sentiment and declining seat utilization.', 'Assign technical support and review renewal blockers.') ON CONFLICT (customer_id) DO NOTHING;
INSERT INTO customer_signals (customer_id, source, usage_drop, open_tickets, sentiment, days_inactive, renewal_days, note) VALUES
 (1, 'product_analytics', 42, 2, 'negative', 11, 36, 'Weekly active users declining'), (2, 'airtable_crm', 18, 1, 'neutral', 8, 90, 'Champion has not logged in'),
 (3, 'product_analytics', 3, 0, 'positive', 1, 150, 'Healthy engagement'), (4, 'support_email', 28, 3, 'negative', 15, 28, 'Repeated billing and integration questions') ON CONFLICT DO NOTHING;
