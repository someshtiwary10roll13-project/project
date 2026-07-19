const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://churn:churn@localhost:5432/churn_signal', max: 10, idleTimeoutMillis: 30000 });
pool.on('error', error => console.error('Unexpected PostgreSQL pool error', error));

const query = (text, params) => pool.query(text, params);

async function migrate() {
  // Lets an already-created local Docker volume safely adopt the latest API fields.
  await query(`ALTER TABLE customer_signals ADD COLUMN IF NOT EXISTS days_inactive INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE customer_signals ADD COLUMN IF NOT EXISTS renewal_days INTEGER NOT NULL DEFAULT 180`);
  await query(`CREATE INDEX IF NOT EXISTS signals_customer_observed_idx ON customer_signals (customer_id, observed_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS health_risk_score_idx ON customer_health (risk_level, score)`);
}

module.exports = { query, pool, migrate };
