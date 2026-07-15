CREATE TABLE customers (
  id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, plan TEXT NOT NULL, csm_email TEXT NOT NULL
);
CREATE TABLE customer_signals (
  id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), source TEXT NOT NULL,
  usage_drop NUMERIC NOT NULL DEFAULT 0, open_tickets INTEGER NOT NULL DEFAULT 0,
  sentiment TEXT NOT NULL DEFAULT 'neutral', note TEXT, observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE customer_health (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id), score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')), insight TEXT, next_step TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO customers (company_name, plan, csm_email) VALUES
 ('Acme Labs', 'Enterprise', 'maya@company.test'), ('Northstar Inc.', 'Growth', 'maya@company.test'),
 ('Bloom & Co.', 'Pro', 'liam@company.test'), ('Vertex Systems', 'Enterprise', 'liam@company.test');
INSERT INTO customer_health (customer_id, score, risk_level, insight, next_step) VALUES
 (1, 38, 'high', 'Weekly active users fell 42% and two priority tickets remain unresolved.', 'Book an executive recovery call today.'),
 (2, 62, 'medium', 'Product adoption is down 18% after the latest release.', 'Share the onboarding refresher with the admin.'),
 (3, 84, 'low', 'Usage and support activity are stable.', 'Continue the regular success cadence.'),
 (4, 48, 'high', 'Negative support sentiment and declining seat utilization.', 'Assign technical support and review renewal blockers.');
INSERT INTO customer_signals (customer_id, source, usage_drop, open_tickets, sentiment, note) VALUES
 (1, 'product_analytics', 42, 2, 'negative', 'Weekly active users declining'),
 (2, 'airtable_crm', 18, 1, 'neutral', 'Champion has not logged in'),
 (3, 'product_analytics', 3, 0, 'positive', 'Healthy engagement'),
 (4, 'support_email', 28, 3, 'negative', 'Repeated billing and integration questions');
