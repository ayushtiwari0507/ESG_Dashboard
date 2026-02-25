/**
 * Unit tests for AuthController
 */

const mockAuthService = {
  login: jest.fn(),
  getProfile: jest.fn(),
};

jest.mock('../../../modules/auth/auth.service', () => ({
  authService: mockAuthService,
}));

jest.mock('../../../config/env', () => ({
  config: {
    port: 4000, nodeEnv: 'test', database: { url: '' },
    jwt: { secret: 'test', expiry: '1h', refreshExpiry: '7d' },
    admin: { email: '', password: '', name: '' },
    logLevel: 'warn',
  },
}));

import { AuthController } from '../../../modules/auth/auth.controller';
import { Request, Response } from 'express';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, user: undefined, ...overrides } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController();
    jest.clearAllMocks();
  });

  /* ── login ── */
  describe('login', () => {
    it('returns token on success', async () => {
      const result = { token: 'jwt', user: { id: 1, email: 'a@b.com' } };
      mockAuthService.login.mockResolvedValueOnce(result);

      const req = mockReq({ body: { email: 'a@b.com', password: 'pass' } });
      const res = mockRes();

      await controller.login(req, res);

      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('returns 401 for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

      const req = mockReq({ body: { email: 'a@b.com', password: 'bad' } });
      const res = mockRes();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('returns 500 for unexpected errors', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ body: { email: 'a@b.com', password: 'pass' } });
      const res = mockRes();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  /* ── me ── */
  describe('me', () => {
    it('returns profile when authenticated', async () => {
      const profile = { id: 1, email: 'a@b.com', fullName: 'A', role: 'admin' };
      mockAuthService.getProfile.mockResolvedValueOnce(profile);

      const req = mockReq({ user: { sub: 1, email: 'a@b.com', role: 'admin', siteIds: [] } } as any);
      const res = mockRes();

      await controller.me(req, res);

      expect(res.json).toHaveBeenCalledWith(profile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith(1);
    });

    it('returns 401 when no user attached', async () => {
      const req = mockReq();
      const res = mockRes();

      await controller.me(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('returns 500 on service error', async () => {
      mockAuthService.getProfile.mockRejectedValueOnce(new Error('fail'));

      const req = mockReq({ user: { sub: 1, email: 'a@b.com', role: 'admin', siteIds: [] } } as any);
      const res = mockRes();

      await controller.me(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
