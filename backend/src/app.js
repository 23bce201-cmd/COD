import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import clientRoutes from './routes/clients.js';
import campaignRoutes from './routes/campaigns.js';
import metricRoutes from './routes/metrics.js';
import dashboardRoutes from './routes/dashboard.js';
import chartRoutes from './routes/charts.js';
import reportRoutes from './routes/reports.js';
import syncRoutes from './routes/sync.js';
import userRoutes from './routes/users.js';
import assignmentRoutes from './routes/assignments.js';
import emailRoutes from './routes/email.js';
import { handleGmailOAuthCallback } from './controllers/reportEmails.js';
import kanbanRoutes from './routes/kanban.js';

import { verifyToken } from './middleware/verifyToken.js';
import { scopeGuard, requireRole } from './middleware/scopeGuard.js';

const app = express();

// ─── Security Headers ───────────────────────────────────────
app.use(helmet());
app.use(helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
}));

// ─── CORS ───────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Auth-Email'],
}));

// ─── Body Parsers ───────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Health Check (unauthenticated) ─────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Google redirects here without app auth headers; the one-time OAuth state maps it to the user.
app.get('/api/reports/email/gmail/callback', handleGmailOAuthCallback);

// ─── Protected Routes ───────────────────────────────────────
const protectedRouter = express.Router();
protectedRouter.use(verifyToken);
protectedRouter.use(scopeGuard);

// Agency-side resources
protectedRouter.use('/clients', requireRole('admin', 'manager', 'employee', 'client'), clientRoutes);
protectedRouter.use('/sync', requireRole('admin', 'manager', 'employee', 'client'), syncRoutes);
protectedRouter.use('/assignments', requireRole('admin'), assignmentRoutes);

// All authenticated roles (scoping handled internally by controllers)
protectedRouter.use('/campaigns', campaignRoutes);
protectedRouter.use('/metrics', metricRoutes);
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/charts', chartRoutes);
protectedRouter.use('/reports', reportRoutes);
protectedRouter.use('/email', emailRoutes);
protectedRouter.use('/kanban', kanbanRoutes);
protectedRouter.use('/users', userRoutes);

app.use('/api', protectedRouter);

// ─── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Global Error Handler ───────────────────────────────────
// Never leaks stack traces, SQL errors, or internal details
app.use((err, req, res, _next) => {
    // Log full error internally
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

    // Never expose internals
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: statusCode === 500
            ? 'An internal error occurred'
            : err.message || 'Something went wrong',
    });
});

export default app;
