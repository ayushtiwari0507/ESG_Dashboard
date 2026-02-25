import request from 'supertest';
import app from '../../app';
import jwt from 'jsonwebtoken';

// Mock prisma for integration tests (no real DB required)
jest.mock('../../config/database', () => {
  const mockPrisma: Record<string, any> = {
    energyData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    productionData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    waterData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    wasteData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eTPData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    salesData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    airEmissionsData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recoveryData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    gHGEmission: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    site: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSite: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((fn: (p: any) => any) => fn(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../../config/env', () => ({
  config: {
    port: 4000,
    nodeEnv: 'test',
    database: { url: '' },
    jwt: {
      secret: 'integration-test-secret-key',
      expiry: '1h',
      refreshExpiry: '7d',
    },
    admin: { email: 'admin@test.com', password: 'testpass', name: 'Test' },
    logLevel: 'warn',
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SECRET = 'integration-test-secret-key';

function makeToken(role: string = 'admin', siteIds: number[] = [1, 2, 3]) {
  return jwt.sign(
    { sub: 1, email: 'test@test.com', role, siteIds },
    SECRET,
    { expiresIn: '1h' }
  );
}

describe('API Routes — Integration Tests', () => {
  const adminToken = makeToken('admin');
  const viewerToken = makeToken('viewer');

  // ── Health ──
  describe('GET /api/health', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('apiVersion', '2026-02-24');
    });
  });

  // ── Auth protection ──
  describe('Route protection', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/2026-02-24/sites');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/sites')
        .set('Authorization', 'Bearer bad-token');
      expect(res.status).toBe(401);
    });

    it('should allow access with valid token', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/sites')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Energy data ──
  describe('GET /api/data/energy', () => {
    it('should return empty array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/energy')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should be accessible by viewer', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/energy')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Water data ──
  describe('POST /api/data/water', () => {
    it('should reject invalid payload (missing siteId)', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/data/water')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ month: 1, year: 2025, freshWaterKl: 100 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('should reject viewer write attempt', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/data/water')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ siteId: 1, month: 1, year: 2025, freshWaterKl: 100 });
      expect(res.status).toBe(403);
    });
  });

  // ── Waste data ──
  describe('GET /api/data/waste', () => {
    it('should return array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/waste')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── ETP data ──
  describe('GET /api/data/etp', () => {
    it('should return array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/etp')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Sales data ──
  describe('GET /api/data/sales', () => {
    it('should return array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/sales')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Air Emissions ──
  describe('GET /api/data/air-emissions', () => {
    it('should return array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/air-emissions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Recovery ──
  describe('GET /api/data/recovery', () => {
    it('should return array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/recovery')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── GHG ──
  describe('GET /api/data/ghg', () => {
    it('should return array', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/data/ghg')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Users (Admin only) ──
  describe('GET /api/users', () => {
    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 200 for admin', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Rate limiting ──
  describe('Rate limiting', () => {
    it('should return rate limit headers', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/sites')
        .set('Authorization', `Bearer ${adminToken}`);
      // express-rate-limit sets these headers on versioned routes
      expect(res.headers).toHaveProperty('x-ratelimit-limit');
    });
  });
});
