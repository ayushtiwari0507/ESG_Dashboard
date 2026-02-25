import request from 'supertest';
import app from '../../app';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    userSite: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((fn: (p: any) => any) => fn(m)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { __esModule: true, default: m };
});

jest.mock('../../config/env', () => ({
  config: {
    port: 4000, nodeEnv: 'test', database: { url: '' },
    jwt: { secret: 'admin-auth-secret', expiry: '1h', refreshExpiry: '7d' },
    admin: { email: 'a@b.com', password: 'x', name: 'A' },
    logLevel: 'warn',
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SECRET = 'admin-auth-secret';
const adminToken = jwt.sign({ sub: 1, email: 'admin@t.com', role: 'admin', siteIds: [1, 2, 3] }, SECRET, { expiresIn: '1h' });
const viewerToken = jwt.sign({ sub: 3, email: 'v@t.com', role: 'viewer', siteIds: [1] }, SECRET, { expiresIn: '1h' });

const prisma = require('../../config/database').default;
const testPasswordHash = bcrypt.hashSync('ValidPass123', 1);

/* ══════════════════════════════════════════════
   AUTH ROUTES
   ══════════════════════════════════════════════ */
describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('returns token on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 1, email: 'admin@t.com', passwordHash: testPasswordHash,
        role: 'admin', fullName: 'Admin', isActive: true,
        userSites: [{ siteId: 1 }],
      });

      const res = await request(app)
        .post('/api/2026-02-24/auth/login')
        .send({ email: 'admin@t.com', password: 'ValidPass123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('admin@t.com');
    });

    it('rejects invalid credentials → 401', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 1, email: 'admin@t.com', passwordHash: testPasswordHash,
        role: 'admin', fullName: 'Admin', isActive: true,
        userSites: [],
      });

      const res = await request(app)
        .post('/api/2026-02-24/auth/login')
        .send({ email: 'admin@t.com', password: 'WRONG' });

      expect(res.status).toBe(401);
    });

    it('rejects non-existent user → 401', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/2026-02-24/auth/login')
        .send({ email: 'nobody@t.com', password: 'pass' });

      expect(res.status).toBe(401);
    });

    it('rejects inactive user → 401', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 2, email: 'inactive@t.com', passwordHash: testPasswordHash,
        role: 'viewer', fullName: 'Inactive', isActive: false,
        userSites: [],
      });

      const res = await request(app)
        .post('/api/2026-02-24/auth/login')
        .send({ email: 'inactive@t.com', password: 'ValidPass123' });

      expect(res.status).toBe(401);
    });

    it('rejects invalid email format → 400', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/auth/login')
        .send({ email: 'not-an-email', password: 'pass' });

      expect(res.status).toBe(400);
    });

    it('rejects missing password → 400', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/auth/login')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns profile for authenticated user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 1, email: 'admin@t.com', fullName: 'Admin',
        role: 'admin', isActive: true,
        userSites: [{ siteId: 1, site: { id: 1, name: 'Site A', code: 'SA' } }],
      });

      const res = await request(app)
        .get('/api/2026-02-24/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email');
    });

    it('rejects unauthenticated → 401', async () => {
      const res = await request(app).get('/api/2026-02-24/auth/me');
      expect(res.status).toBe(401);
    });
  });
});

/* ══════════════════════════════════════════════
   USERS ROUTES
   ══════════════════════════════════════════════ */
describe('Users Routes', () => {
  beforeEach(() => {
    // Reset user mocks to avoid queue pollution from previous tests
    prisma.user.findUniqueOrThrow.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.create.mockReset();
    prisma.user.update.mockReset();
    prisma.userSite.createMany.mockReset();
    prisma.userSite.deleteMany.mockReset();
    // Re-establish defaults
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 1 });
    prisma.user.create.mockResolvedValue({ id: 1 });
    prisma.user.update.mockResolvedValue({ id: 1 });
    prisma.userSite.createMany.mockResolvedValue({});
    prisma.userSite.deleteMany.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
  });
  describe('GET /api/users/:id', () => {
    it('returns user for admin', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5, email: 'user@t.com', fullName: 'User', role: 'viewer',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
        userSites: [],
      });
      const res = await request(app)
        .get('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('user@t.com');
    });

    it('returns 404 when user not found', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
      const res = await request(app)
        .get('/api/2026-02-24/users/999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 500 on server error', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/users/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/users', () => {
    it('creates user → 201', async () => {
      prisma.user.create.mockResolvedValueOnce({
        id: 10, email: 'new@t.com', fullName: 'New',
        role: 'viewer', isActive: true, createdAt: new Date(),
      });
      prisma.userSite.createMany.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@t.com', password: 'SecurePass1', fullName: 'New',
          role: 'viewer', siteIds: [1],
        });

      expect(res.status).toBe(201);
    });

    it('handles duplicate email → 409', async () => {
      prisma.user.create.mockRejectedValueOnce({ code: 'P2002' });

      const res = await request(app)
        .post('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'dup@t.com', password: 'SecurePass1', fullName: 'Dup',
        });

      expect(res.status).toBe(409);
    });

    it('handles server error → 500', async () => {
      prisma.user.create.mockRejectedValueOnce(new Error('DB'));

      const res = await request(app)
        .post('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'err@t.com', password: 'SecurePass1', fullName: 'Err',
        });

      expect(res.status).toBe(500);
    });

    it('rejects invalid email → 400', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'bad', password: 'SecurePass1', fullName: 'Bad',
        });

      expect(res.status).toBe(400);
    });

    it('rejects short password → 400', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'ok@t.com', password: 'short', fullName: 'Short',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('updates user → 200', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5, email: 'old@t.com', fullName: 'Old', role: 'viewer',
        isActive: true, passwordHash: 'xxx',
        userSites: [{ siteId: 1 }],
      });
      prisma.user.update.mockResolvedValueOnce({
        id: 5, email: 'updated@t.com', fullName: 'Updated',
        role: 'site_user', isActive: true, updatedAt: new Date(),
      });
      prisma.userSite.deleteMany.mockResolvedValueOnce({});
      prisma.userSite.createMany.mockResolvedValueOnce({});

      const res = await request(app)
        .put('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'updated@t.com', fullName: 'Updated',
          role: 'site_user', siteIds: [1, 2],
        });

      expect(res.status).toBe(200);
    });

    it('updates password', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5, email: 'u@t.com', fullName: 'U', role: 'viewer',
        isActive: true, passwordHash: 'xxx', userSites: [],
      });
      prisma.user.update.mockResolvedValueOnce({
        id: 5, email: 'u@t.com', fullName: 'U',
        role: 'viewer', isActive: true, updatedAt: new Date(),
      });

      const res = await request(app)
        .put('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'NewSecureP1' });

      expect(res.status).toBe(200);
    });

    it('returns 404 when user not found', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
      const res = await request(app)
        .put('/api/2026-02-24/users/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fullName: 'X' });
      expect(res.status).toBe(404);
    });

    it('handles duplicate email → 409', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5, email: 'a@t.com', fullName: 'A', role: 'viewer',
        isActive: true, passwordHash: 'x', userSites: [],
      });
      prisma.user.update.mockRejectedValueOnce({ code: 'P2002' });

      const res = await request(app)
        .put('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'taken@t.com' });
      expect(res.status).toBe(409);
    });

    it('handles server error → 500', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .put('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fullName: 'X' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deactivates user → 204', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5, email: 'del@t.com', isActive: true,
      });
      prisma.user.update.mockResolvedValueOnce({ id: 5, isActive: false });

      const res = await request(app)
        .delete('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('prevents self-deactivation → 400', async () => {
      // Admin token has sub:1, so deleting user 1 should fail
      const res = await request(app)
        .delete('/api/2026-02-24/users/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/own account/i);
    });

    it('returns 404 when user not found', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
      const res = await request(app)
        .delete('/api/2026-02-24/users/999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('handles server error → 500', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .delete('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });

    it('rejects non-admin → 403', async () => {
      const res = await request(app)
        .delete('/api/2026-02-24/users/5')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });
});

/* ══════════════════════════════════════════════
   AUDIT LOG ROUTES
   ══════════════════════════════════════════════ */
describe('Audit Log Routes', () => {
  describe('GET /api/audit-logs', () => {
    it('returns audit logs for admin', async () => {
      prisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: BigInt(1), tableName: 'energy_data', recordId: 1,
          action: 'INSERT', oldValue: null, newValue: {}, changedBy: 1,
          changedAt: new Date(), user: { fullName: 'Admin', email: 'a@t.com' },
        },
      ]);

      const res = await request(app)
        .get('/api/2026-02-24/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('id', '1'); // BigInt → string
    });

    it('applies query filters', async () => {
      prisma.auditLog.findMany.mockResolvedValueOnce([]);
      const res = await request(app)
        .get('/api/2026-02-24/audit-logs?table=energy_data&recordId=1&userId=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('rejects non-admin → 403', async () => {
      const res = await request(app)
        .get('/api/2026-02-24/audit-logs')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('handles server error → 500', async () => {
      prisma.auditLog.findMany.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });
});

/* ══════════════════════════════════════════════
   SITES ROUTES
   ══════════════════════════════════════════════ */
describe('Sites Routes', () => {
  describe('GET /api/sites/:id', () => {
    it('returns site details', async () => {
      prisma.site.findUnique.mockResolvedValueOnce({
        id: 1, name: 'Site A', code: 'SA', isActive: true,
      });
      const res = await request(app)
        .get('/api/2026-02-24/sites/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Site A');
    });

    it('returns 404 when site not found', async () => {
      prisma.site.findUnique.mockResolvedValueOnce(null);
      const res = await request(app)
        .get('/api/2026-02-24/sites/999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('handles server error → 500', async () => {
      prisma.site.findUnique.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/sites/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/sites', () => {
    it('handles server error → 500', async () => {
      prisma.site.findMany.mockRejectedValueOnce(new Error('DB'));
      const res = await request(app)
        .get('/api/2026-02-24/sites')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(500);
    });
  });
});

/* ══════════════════════════════════════════════
   TELEMETRY ROUTES
   ══════════════════════════════════════════════ */
describe('Telemetry Routes', () => {
  describe('POST /api/telemetry/error', () => {
    it('accepts error report → 204', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/telemetry/error')
        .send({
          message: 'Test error',
          stack: 'Error: Test\n  at ...',
          url: '/dashboard',
          userAgent: 'test-agent',
        });
      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/telemetry/vitals', () => {
    it('accepts web vital → 204', async () => {
      const res = await request(app)
        .post('/api/2026-02-24/telemetry/vitals')
        .send({
          name: 'LCP',
          value: 2500,
          id: 'v1-123',
          navigationType: 'navigate',
          rating: 'good',
        });
      expect(res.status).toBe(204);
    });
  });
});
