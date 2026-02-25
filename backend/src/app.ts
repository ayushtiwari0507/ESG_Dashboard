import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import logger from './config/logger';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import sitesRoutes from './modules/sites/sites.routes';
import energyRoutes from './modules/data-entry/energy/energy.routes';
import productionRoutes from './modules/data-entry/production/production.routes';
import waterRoutes from './modules/data-entry/water/water.routes';
import wasteRoutes from './modules/data-entry/waste/waste.routes';
import etpRoutes from './modules/data-entry/etp/etp.routes';
import ghgRoutes from './modules/data-entry/ghg/ghg.routes';
import airEmissionsRoutes from './modules/data-entry/air-emissions/air-emissions.routes';
import salesRoutes from './modules/data-entry/sales/sales.routes';
import recoveryRoutes from './modules/data-entry/recovery/recovery.routes';
import usersRoutes from './modules/users/users.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import auditRoutes from './modules/audit/audit.routes';
import telemetryRoutes from './modules/telemetry/telemetry.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ── API Version ──
// Date-based API version. All routes are mounted under /api/<version>/
export const API_VERSION = '2026-02-24';
const versionedBase = `/api/${API_VERSION}`;

// ── Core Middleware ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP Logging ──
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim(), { type: 'http' }) },
}));

// ── Rate Limiting ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, try again in 15 minutes' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: 'Too many requests, slow down' },
});

// ── Routes ──
app.use(`${versionedBase}/auth/login`, authLimiter);
app.use(versionedBase, apiLimiter);

app.use(`${versionedBase}/auth`, authRoutes);
app.use(`${versionedBase}/sites`, sitesRoutes);
app.use(`${versionedBase}/users`, usersRoutes);
app.use(`${versionedBase}/data/energy`, energyRoutes);
app.use(`${versionedBase}/data/production`, productionRoutes);
app.use(`${versionedBase}/data/water`, waterRoutes);
app.use(`${versionedBase}/data/waste`, wasteRoutes);
app.use(`${versionedBase}/data/etp`, etpRoutes);
app.use(`${versionedBase}/data/ghg`, ghgRoutes);
app.use(`${versionedBase}/data/air-emissions`, airEmissionsRoutes);
app.use(`${versionedBase}/data/sales`, salesRoutes);
app.use(`${versionedBase}/data/recovery`, recoveryRoutes);
app.use(`${versionedBase}/dashboard`, dashboardRoutes);
app.use(`${versionedBase}/audit-logs`, auditRoutes);
app.use(`${versionedBase}/telemetry`, telemetryRoutes);

// ── Health Check (unversioned — always available) ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), apiVersion: API_VERSION });
});

// ── Error Handler ──
app.use(errorHandler);

export default app;
