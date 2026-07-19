require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'PATCH'] }));
app.use(express.json({ limit: '256kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'retainiq-api', timestamp: new Date().toISOString() }));
app.use('/api', apiRouter);
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : err.message });
});

module.exports = app;
