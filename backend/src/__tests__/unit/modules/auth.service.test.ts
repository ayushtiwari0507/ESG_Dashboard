import { AuthService } from '../../../modules/auth/auth.service';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../config/env', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-for-unit-tests-only',
      expiry: '1h',
      refreshExpiry: '7d',
    },
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const prisma = require('../../../config/database').default;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockUser = {
      id: 1,
      email: 'admin@test.com',
      passwordHash: '', // set in beforeAll
      fullName: 'Test Admin',
      role: 'admin',
      isActive: true,
      userSites: [{ siteId: 1 }, { siteId: 2 }],
    };

    beforeAll(async () => {
      mockUser.passwordHash = await bcrypt.hash('correctPassword', 10);
    });

    it('should return tokens and user data for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'admin@test.com',
        password: 'correctPassword',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe('admin');
      expect(result.user.siteIds).toEqual([1, 2]);
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should throw for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({ email: 'admin@test.com', password: 'wrongPassword' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@test.com', password: 'anypass' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        authService.login({ email: 'admin@test.com', password: 'correctPassword' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should log warning on failed login attempt', async () => {
      const logger = require('../../../config/logger').default;
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'hacker@evil.com', password: 'attempt' })
      ).rejects.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed login attempt')
      );
    });

    it('should log info on successful login', async () => {
      const logger = require('../../../config/logger').default;
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authService.login({ email: 'admin@test.com', password: 'correctPassword' });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('User logged in: admin@test.com')
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile with sites', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'admin@test.com',
        fullName: 'Test Admin',
        role: 'admin',
        userSites: [
          { site: { id: 1, name: 'Taloja', code: 'TAL' } },
          { site: { id: 2, name: 'Daman', code: 'DAM' } },
        ],
      });

      const profile = await authService.getProfile(1);
      expect(profile.email).toBe('admin@test.com');
      expect(profile.sites).toHaveLength(2);
      expect(profile.sites[0].code).toBe('TAL');
    });

    it('should throw for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(authService.getProfile(999)).rejects.toThrow('User not found');
    });
  });
});
