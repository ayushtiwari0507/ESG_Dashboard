import request from 'supertest';
import app from '../../app';
import jwt from 'jsonwebtoken';

/* ── Mocks ── */
jest.mock('../../config/database', () => {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1, site: { name: 'S', code: 'S1' } }),
    update: jest.fn().mockResolvedValue({ id: 1, site: { name: 'S', code: 'S1' } }),
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
    jwt: { secret: 'data-crud-secret', expiry: '1h', refreshExpiry: '7d' },
    admin: { email: 'a@b.com', password: 'x', name: 'A' },
    logLevel: 'warn',
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SECRET = 'data-crud-secret';
const adminToken = jwt.sign({ sub: 1, email: 't@t.com', role: 'admin', siteIds: [1, 2, 3] }, SECRET, { expiresIn: '1h' });
const siteUserToken = jwt.sign({ sub: 2, email: 'u@t.com', role: 'site_user', siteIds: [1] }, SECRET, { expiresIn: '1h' });
const viewerToken = jwt.sign({ sub: 3, email: 'v@t.com', role: 'viewer', siteIds: [1] }, SECRET, { expiresIn: '1h' });

const prisma = require('../../config/database').default;

/* ── Module Definitions ── */
interface Mod {
  name: string;
  path: string;
  model: string;
  payload: Record<string, any>;
  updatePayload: Record<string, any>;
  existing: Record<string, any>;
  hasPut: boolean;
  hasDelete: boolean;
  hasP2002: boolean;
}

const modules: Mod[] = [
  {
    name: 'Water', path: '/api/2026-02-24/data/water', model: 'waterData',
    payload: { siteId: 1, month: 1, year: 2025, freshWaterKl: 100, recycledWaterKl: 50, dischargeKl: 30 },
    updatePayload: { freshWaterKl: 200 },
    existing: { id: 1, siteId: 1, month: 1, year: 2025, freshWaterKl: 100, recycledWaterKl: 50, dischargeKl: 30, totalConsumptionKl: 150 },
    hasPut: true, hasDelete: false, hasP2002: true,
  },
  {
    name: 'Waste', path: '/api/2026-02-24/data/waste', model: 'wasteData',
    payload: { siteId: 1, month: 1, year: 2025, wasteType: 'hazardous', disposalMethod: 'recycled', quantityMt: 10 },
    updatePayload: { quantityMt: 20 },
    existing: { id: 1, siteId: 1, month: 1, year: 2025, wasteType: 'hazardous', disposalMethod: 'recycled', quantityMt: 10 },
    hasPut: true, hasDelete: true, hasP2002: false,
  },
  {
    name: 'ETP', path: '/api/2026-02-24/data/etp', model: 'eTPData',
    payload: { siteId: 1, month: 1, year: 2025, codMgPerL: 100 },
    updatePayload: { codMgPerL: 200 },
    existing: { id: 1, siteId: 1, month: 1, year: 2025, codMgPerL: 100, bodMgPerL: null, tssMgPerL: null, tdsMgPerL: null, sludgeMt: null },
    hasPut: true, hasDelete: true, hasP2002: false,
  },
  {
    name: 'Sales', path: '/api/2026-02-24/data/sales', model: 'salesData',
    payload: { siteId: 1, month: 1, year: 2025, quantityMt: 100 },
    updatePayload: { quantityMt: 200 },
    existing: { id: 1, siteId: 1, month: 1, year: 2025, quantityMt: 100 },
    hasPut: true, hasDelete: true, hasP2002: false,
  },
  {
    name: 'Air Emissions', path: '/api/2026-02-24/data/air-emissions', model: 'airEmissionsData',
    payload: { siteId: 1, month: 1, year: 2025, soxKg: 10, noxKg: 20 },
    updatePayload: { soxKg: 15 },
    existing: { id: 1, siteId: 1, month: 1, year: 2025, soxKg: 10, noxKg: 20, pmKg: 0, vocKg: 0, stackId: null },
    hasPut: true, hasDelete: true, hasP2002: false,
  },
  {
    name: 'Recovery', path: '/api/2026-02-24/data/recovery', model: 'recoveryData',
    payload: { siteId: 1, month: 1, year: 2025, materialName: 'Scrap', quantityMt: 50 },
    updatePayload: { quantityMt: 100 },
    existing: { id: 1, siteId: 1, month: 1, year: 2025, materialName: 'Scrap', quantityMt: 50 },
    hasPut: true, hasDelete: true, hasP2002: false,
  },
  {
    name: 'GHG', path: '/api/2026-02-24/data/ghg', model: 'gHGEmission',
    payload: {
      siteId: 1, month: 1, year: 2025, scope: 'scope_1',
      sourceDescription: 'Coal combustion', activityData: 100,
      activityUnitId: 1, emissionFactorId: 1, co2eTonnes: 50,
    },
    updatePayload: { co2eTonnes: 60 },
    existing: {
      id: 1, siteId: 1, month: 1, year: 2025, scope: 'scope_1',
      scope1Category: null, scope2Method: null, scope3Category: null,
      sourceDescription: 'Coal', activityData: 100,
      activityUnitId: 1, emissionFactorId: 1,
      co2Tonnes: null, ch4Tonnes: null, n2oTonnes: null, co2eTonnes: 50,
    },
    hasPut: true, hasDelete: true, hasP2002: false,
  },
  {
    name: 'Energy', path: '/api/2026-02-24/data/energy', model: 'energyData',
    payload: { siteId: 1, month: 1, year: 2025, electricityKwh: 1000 },
    updatePayload: { electricityKwh: 2000 },
    existing: {
      id: 1, siteId: 1, month: 1, year: 2025,
      electricityKwh: 1000, steamMt: 0, coalMt: 0, dieselLitres: 0,
      foLitres: 0, lpgKg: 0, pngScm: 0, renewableKwh: 0, totalEnergyGj: 3.6,
    },
    hasPut: true, hasDelete: true, hasP2002: true,
  },
  {
    name: 'Production', path: '/api/2026-02-24/data/production', model: 'productionData',
    payload: { siteId: 1, month: 1, year: 2025, quantityMt: 500 },
    updatePayload: {},
    existing: { id: 1, siteId: 1, month: 1, year: 2025, quantityMt: 500 },
    hasPut: false, hasDelete: false, hasP2002: true,
  },
];

/* ── Factory Tests ── */
describe('Data Module CRUD — Integration Tests', () => {

  beforeEach(() => {
    // Ensure auditLog.create always succeeds
    prisma.auditLog.create.mockResolvedValue({});
  });

  modules.forEach((mod) => {
    describe(`${mod.name} (${mod.path})`, () => {
      const model = () => prisma[mod.model];

      beforeEach(() => {
        // Reset model mocks to avoid queue pollution between tests
        const m = model();
        m.findMany.mockReset().mockResolvedValue([]);
        m.create.mockReset().mockResolvedValue({ id: 1, site: { name: 'S', code: 'S1' } });
        m.findUniqueOrThrow.mockReset().mockResolvedValue({ id: 1 });
        m.update.mockReset().mockResolvedValue({ id: 1, site: { name: 'S', code: 'S1' } });
        m.delete.mockReset().mockResolvedValue({ id: 1 });
        prisma.auditLog.create.mockResolvedValue({});
      });

      /* ── POST ── */
      describe('POST /', () => {
        it('creates record → 201', async () => {
          model().create.mockResolvedValueOnce({ id: 1, ...mod.payload, site: { name: 'S', code: 'S1' } });
          const res = await request(app)
            .post(mod.path)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(mod.payload);
          expect(res.status).toBe(201);
        });

        it('rejects viewer write → 403', async () => {
          const res = await request(app)
            .post(mod.path)
            .set('Authorization', `Bearer ${viewerToken}`)
            .send(mod.payload);
          expect(res.status).toBe(403);
        });

        it('allows site_user write → 201', async () => {
          model().create.mockResolvedValueOnce({ id: 2, ...mod.payload, site: { name: 'S', code: 'S1' } });
          const res = await request(app)
            .post(mod.path)
            .set('Authorization', `Bearer ${siteUserToken}`)
            .send(mod.payload);
          expect(res.status).toBe(201);
        });

        if (mod.hasP2002) {
          it('handles unique constraint → 409', async () => {
            model().create.mockRejectedValueOnce({ code: 'P2002' });
            const res = await request(app)
              .post(mod.path)
              .set('Authorization', `Bearer ${adminToken}`)
              .send(mod.payload);
            expect(res.status).toBe(409);
          });
        }

        it('handles server error → 500', async () => {
          model().create.mockRejectedValueOnce(new Error('DB down'));
          const res = await request(app)
            .post(mod.path)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(mod.payload);
          expect(res.status).toBe(500);
        });
      });

      /* ── PUT ── */
      if (mod.hasPut) {
        describe('PUT /:id', () => {
          it('updates record → 200', async () => {
            model().findUniqueOrThrow.mockResolvedValueOnce(mod.existing);
            model().update.mockResolvedValueOnce({ ...mod.existing, ...mod.updatePayload, site: { name: 'S', code: 'S1' } });
            const res = await request(app)
              .put(`${mod.path}/1`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send(mod.updatePayload);
            expect(res.status).toBe(200);
          });

          it('returns 404 when not found (P2025)', async () => {
            model().findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
            const res = await request(app)
              .put(`${mod.path}/999`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send(mod.updatePayload);
            expect(res.status).toBe(404);
          });

          it('handles server error → 500', async () => {
            model().findUniqueOrThrow.mockRejectedValueOnce(new Error('DB down'));
            const res = await request(app)
              .put(`${mod.path}/1`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send(mod.updatePayload);
            expect(res.status).toBe(500);
          });
        });
      }

      /* ── DELETE ── */
      if (mod.hasDelete) {
        describe('DELETE /:id', () => {
          it('deletes record → 204', async () => {
            model().findUniqueOrThrow.mockResolvedValueOnce(mod.existing);
            model().delete.mockResolvedValueOnce({});
            const res = await request(app)
              .delete(`${mod.path}/1`)
              .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(204);
          });

          it('returns 404 when not found (P2025)', async () => {
            model().findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
            const res = await request(app)
              .delete(`${mod.path}/999`)
              .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(404);
          });

          it('rejects non-admin → 403', async () => {
            const res = await request(app)
              .delete(`${mod.path}/1`)
              .set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(403);
          });

          it('handles server error → 500', async () => {
            model().findUniqueOrThrow.mockRejectedValueOnce(new Error('DB down'));
            const res = await request(app)
              .delete(`${mod.path}/1`)
              .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(500);
          });
        });
      }

      /* ── GET with query filters ── */
      describe('GET / with filters', () => {
        it('applies siteId, month, year filters', async () => {
          model().findMany.mockResolvedValueOnce([{ id: 1, ...mod.payload }]);
          const res = await request(app)
            .get(`${mod.path}?siteId=1&month=6&year=2025`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(200);
          expect(Array.isArray(res.body)).toBe(true);
        });

        it('handles server error → 500', async () => {
          model().findMany.mockRejectedValueOnce(new Error('DB down'));
          const res = await request(app)
            .get(mod.path)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(500);
        });
      });
    });
  });

  /* ── GHG scope filter ── */
  describe('GHG scope query filter', () => {
    it('passes scope filter', async () => {
      prisma.gHGEmission.findMany.mockResolvedValueOnce([]);
      const res = await request(app)
        .get('/api/2026-02-24/data/ghg?scope=scope_1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
