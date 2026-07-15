require('dotenv').config();
const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'churn-signal-api' }));
app.use('/api', healthRouter);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong while processing the customer signal.' });
});

module.exports = app;
