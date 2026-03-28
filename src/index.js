'use strict';

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const AppError = require('./errors/AppError');
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const { globalLimiter, sensitiveLimiter } = require('./middleware/rateLimit');
const { sanitizeInput } = require('./middleware/sanitizeInput');
const { createSecurityMiddleware } = require('./middleware/security');
const { callSorobanContract } = require('./services/soroban');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory storage for invoices (Issue #25)
let invoices = [];

app.use(createSecurityMiddleware());
app.use(cors());
app.use(express.json());
app.use(sanitizeInput);
app.use(globalLimiter);

app.get('/health', (_req, res) => {
  return res.json({
    status: 'ok',
    service: 'liquifact-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req, res) => {
  return res.json({
    name: 'LiquiFact API',
    description: 'Global Invoice Liquidity Network on Stellar',
    endpoints: {
      health: 'GET /health',
      invoices: 'GET/POST /api/invoices',
      escrow: 'GET/POST /api/escrow',
    },
  });
});

app.get('/api/invoices', (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const filteredInvoices = includeDeleted
    ? invoices
    : invoices.filter((inv) => !inv.deletedAt);

  return res.json({
    data: filteredInvoices,
    message: includeDeleted
      ? 'Showing all invoices (including deleted).'
      : 'Showing active invoices.',
  });
});

app.post('/api/invoices', authenticateToken, sensitiveLimiter, (req, res) => {
  const { amount, customer } = req.body;

  if (!amount || !customer) {
    return res.status(400).json({ error: 'Amount and customer are required' });
  }

  const newInvoice = {
    id: `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    amount,
    customer,
    status: 'pending_verification',
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };

  invoices.push(newInvoice);

  return res.status(201).json({
    data: newInvoice,
    message: 'Invoice uploaded successfully.',
  });
});

app.delete('/api/invoices/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const invoiceIndex = invoices.findIndex((inv) => inv.id === id);

  if (invoiceIndex === -1) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (invoices[invoiceIndex].deletedAt) {
    return res.status(400).json({ error: 'Invoice is already deleted' });
  }

  invoices[invoiceIndex].deletedAt = new Date().toISOString();

  return res.json({
    message: 'Invoice soft-deleted successfully.',
    data: invoices[invoiceIndex],
  });
});

app.patch('/api/invoices/:id/restore', authenticateToken, (req, res) => {
  const { id } = req.params;
  const invoiceIndex = invoices.findIndex((inv) => inv.id === id);

  if (invoiceIndex === -1) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (!invoices[invoiceIndex].deletedAt) {
    return res.status(400).json({ error: 'Invoice is not deleted' });
  }

  invoices[invoiceIndex].deletedAt = null;

  return res.json({
    message: 'Invoice restored successfully.',
    data: invoices[invoiceIndex],
  });
});

app.get('/api/escrow/:invoiceId', authenticateToken, async (req, res) => {
  const { invoiceId } = req.params;

  try {
    /**
     * Simulates a remote Soroban operation.
     *
     * @returns {Promise<{invoiceId: string, status: string, fundedAmount: number}>}
     * Escrow payload.
     */
    const operation = async () => {
      return { invoiceId, status: 'not_found', fundedAmount: 0 };
    };

    const data = await callSorobanContract(operation);

    return res.json({
      data,
      message: 'Escrow state read from Soroban contract via robust integration wrapper.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error fetching escrow state' });
  }
});

app.post('/api/escrow', authenticateToken, sensitiveLimiter, (req, res) => {
  const invoiceId = req.body.invoiceId || 'placeholder_invoice';

  return res.json({
    data: {
      invoiceId,
      status: 'funded',
      fundedAmount: req.body.fundedAmount || 0,
    },
  });
});

app.get('/error-test-trigger', (_req, _res, next) => {
  next(new Error('Intentional test error'));
});

app.use((req, _res, next) => {
  next(
    new AppError({
      type: 'https://liquifact.com/probs/not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: `The path ${req.path} does not exist.`,
      instance: req.originalUrl,
    })
  );
});

app.use(errorHandler);

/**
 * Starts the HTTP server.
 *
 * @returns {import('http').Server} Created server instance.
 */
const startServer = () => {
  const server = app.listen(PORT, () => {
    console.warn(`LiquiFact API running at http://localhost:${PORT}`);
  });
  return server;
};

/**
 * Resets the in-memory invoice collection for tests.
 *
 * @returns {void}
 */
const resetStore = () => {
  invoices = [];
};

if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  startServer();
}

module.exports = app;
module.exports.app = app;
module.exports.startServer = startServer;
module.exports.resetStore = resetStore;
