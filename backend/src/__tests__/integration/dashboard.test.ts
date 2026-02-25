import request from 'supertest';
import app from '../../app';
import jwt from 'jsonwebtoken';

/* ── Mocks ── */
jest.mock('../../config/database', () => {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1 }),
    findUnique: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
  });
  const m: Record<string, any> = {
    waterData: model(), wasteData: model(), eTPData: model(),
    salesData: model(), airEmissionsData: model(), recoveryData: model(),
    gHGEmission: model(), energyData: model(), productionData: model(),
    site: model(), user: model(),
    userSite: { createMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((fn: (p: any) => any) => fn(m)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { __esModule: true, default: m };
});

jest.mock('../../config/env', () => ({
  config: {
    port: 4000, nodeEnv: 'test', database: { url: '' },
    jwt: { secret: 'dash-secret', expiry: '1h', refreshExpiry: '7d' },
    admin: { email: 'a@b.com', password: 'x', name: 'A' },
    logLevel: 'warn',
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SECRET = 'dash-secret';
const adminToken = jwt.sign({ sub: 1, email: 't@t.com', role: 'admin', siteIds: [1, 2] }, SECRET, { expiresIn: '1h' });

const prisma = require('../../config/database').default;

describe('Dashboard Routes', () => {

  /* ── GET /api/dashboard/summary ── */
  describe('GET /api/dashboard/summary', () => {
    it('returns summary with default year', async () => {
      prisma.productionData.aggregate.mockResolvedValueOnce({ _sum: { quantityMt: 1000 } });
      prisma.energyData.aggregate.mockResolvedValueOnce({
        _sum: { totalEnergyGj: 500, electricityKwh: 10000, renewableKwh: 2000 },
      });
      prisma.waterData.aggregate.mockResolvedValueOnce({
        _sum: { freshWaterKl: 200, recycledWaterKl: 50, totalConsumptionKl: 250 },
      });
      prisma.wasteData.aggregate
        .mockResolvedValueOnce({ _sum: { quantityMt: 80 } })   // total waste
        .mockResolvedValueOnce({ _sum: { quantityMt: 30 } });  // recycled waste
      prisma.gHGEmission.groupBy.mockResolvedValueOnce([
        { scope: 'scope_1', _sum: { co2eTonnes: 100 } },
        { scope: 'scope_2', _sum: { co2eTonnes: 50 } },
        { scope: 'scope_3', _sum: { co2eTonnes: 25 } },
      ]);

      const res = await request(app)
        .get('/api/2026-02-24/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalScope1');
      expect(res.body).toHaveProperty('totalScope2');
      expect(res.body).toHaveProperty('totalScope3');
      expect(res.body).toHaveProperty('totalGroupEmissions');
      expect(res.body).toHaveProperty('carbonIntensity');
      expect(res.body).toHaveProperty('energyIntensity');
      expect(res.body).toHaveProperty('waterIntensity');
      expect(res.body).toHaveProperty('wasteIntensity');
      expect(res.body).toHaveProperty('renewableEnergyPct');
      expect(res.body).toHaveProperty('recoveryPct');
      expect(res.body).toHaveProperty('productionTotal');
      expect(res.body.totalScope1).toBe(100);
      expect(res.body.totalScope2).toBe(50);
      expect(res.body.totalScope3).toBe(25);
      expect(res.body.totalGroupEmissions).toBe(175);
    });

    it('returns summary with siteId and year filters', async () => {
      prisma.productionData.aggregate.mockResolvedValueOnce({ _sum: { quantityMt: 0 } });
      prisma.energyData.aggregate.mockResolvedValueOnce({ _sum: { totalEnergyGj: 0, electricityKwh: 0, renewableKwh: 0 } });
      prisma.waterData.aggregate.mockResolvedValueOnce({ _sum: { freshWaterKl: 0, recycledWaterKl: 0, totalConsumptionKl: 0 } });
      prisma.wasteData.aggregate
        .mockResolvedValueOnce({ _sum: { quantityMt: 0 } })
        .mockResolvedValueOnce({ _sum: { quantityMt: 0 } });
      prisma.gHGEmission.groupBy.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/2026-02-24/dashboard/summary?siteId=1&year=2024')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.siteId).toBe(1);
      // With zero production, intensities should be 0
      expect(res.body.carbonIntensity).toBe(0);
      expect(res.body.energyIntensity).toBe(0);
    });

    it('handles server error → 500', async () => {
      prisma.productionData.aggregate.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });

  /* ── GET /api/dashboard/site-comparison ── */
  describe('GET /api/dashboard/site-comparison', () => {
    it('returns site comparison data', async () => {
      prisma.site.findMany.mockResolvedValueOnce([
        { id: 1, name: 'Site A', code: 'SA', isActive: true },
        { id: 2, name: 'Site B', code: 'SB', isActive: true },
      ]);
      // For each site: energy, production, ghg aggregates
      prisma.energyData.aggregate
        .mockResolvedValueOnce({ _sum: { totalEnergyGj: 100 } })
        .mockResolvedValueOnce({ _sum: { totalEnergyGj: 200 } });
      prisma.productionData.aggregate
        .mockResolvedValueOnce({ _sum: { quantityMt: 500 } })
        .mockResolvedValueOnce({ _sum: { quantityMt: 800 } });
      prisma.gHGEmission.aggregate
        .mockResolvedValueOnce({ _sum: { co2eTonnes: 50 } })
        .mockResolvedValueOnce({ _sum: { co2eTonnes: 75 } });

      const res = await request(app)
        .get('/api/2026-02-24/dashboard/site-comparison')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('siteName', 'Site A');
      expect(res.body[0]).toHaveProperty('totalEnergyGj', 100);
      expect(res.body[1]).toHaveProperty('siteName', 'Site B');
    });

    it('returns empty when no sites', async () => {
      prisma.site.findMany.mockResolvedValueOnce([]);
      const res = await request(app)
        .get('/api/2026-02-24/dashboard/site-comparison?year=2024')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('handles error → 500', async () => {
      prisma.site.findMany.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/dashboard/site-comparison')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });

  /* ── GET /api/dashboard/emissions-trend ── */
  describe('GET /api/dashboard/emissions-trend', () => {
    it('returns 12-month trend data', async () => {
      prisma.energyData.findMany.mockResolvedValueOnce([
        { month: 1, totalEnergyGj: 100, electricityKwh: 5000, renewableKwh: 1000 },
        { month: 1, totalEnergyGj: 50, electricityKwh: 2000, renewableKwh: 500 },
        { month: 3, totalEnergyGj: 80, electricityKwh: 4000, renewableKwh: 800 },
      ]);

      const res = await request(app)
        .get('/api/2026-02-24/dashboard/emissions-trend')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(12);
      // Month 1 should aggregate two entries
      expect(res.body[0].month).toBe(1);
      expect(res.body[0].totalEnergyGj).toBe(150);
      // Month 2 has no data
      expect(res.body[1].totalEnergyGj).toBe(0);
      // Month 3
      expect(res.body[2].totalEnergyGj).toBe(80);
    });

    it('applies siteId filter', async () => {
      prisma.energyData.findMany.mockResolvedValueOnce([]);
      const res = await request(app)
        .get('/api/2026-02-24/dashboard/emissions-trend?siteId=1&year=2024')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(12);
    });

    it('handles error → 500', async () => {
      prisma.energyData.findMany.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/dashboard/emissions-trend')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });

  /* ── Auth required ── */
  describe('Auth protection', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/2026-02-24/dashboard/summary');
      expect(res.status).toBe(401);
    });
  });
});
