const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://churn:churn@localhost:5432/churn_signal' });
module.exports = { query: (text, params) => pool.query(text, params) };
