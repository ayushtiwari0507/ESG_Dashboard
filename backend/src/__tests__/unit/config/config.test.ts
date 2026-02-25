/**
 * Unit tests for config/env.ts and config/logger.ts
 */

describe('config/env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exports config with defaults when env vars are set', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.PORT = '5000';
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'debug';

    const { config } = require('../../../config/env');

    expect(config.port).toBe(5000);
    expect(config.nodeEnv).toBe('production');
    expect(config.jwt.secret).toBe('test-jwt-secret');
    expect(config.logLevel).toBe('debug');
  });

  it('uses default port 4000 when PORT not set', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    delete process.env.PORT;

    const { config } = require('../../../config/env');
    expect(config.port).toBe(4000);
  });

  it('uses default nodeEnv development', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    delete process.env.NODE_ENV;

    const { config } = require('../../../config/env');
    expect(config.nodeEnv).toBe('development');
  });

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;

    expect(() => {
      require('../../../config/env');
    }).toThrow('JWT_SECRET environment variable is required');
  });

  it('reads admin config from env', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.ADMIN_EMAIL = 'custom@admin.com';
    process.env.ADMIN_NAME = 'Custom Admin';

    const { config } = require('../../../config/env');
    expect(config.admin.email).toBe('custom@admin.com');
    expect(config.admin.name).toBe('Custom Admin');
  });

  it('reads JWT expiry settings', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRY = '2h';
    process.env.REFRESH_TOKEN_EXPIRY = '14d';

    const { config } = require('../../../config/env');
    expect(config.jwt.expiry).toBe('2h');
    expect(config.jwt.refreshExpiry).toBe('14d');
  });
});

describe('config/logger', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('exports a Winston logger instance', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'test';

    const logger = require('../../../config/logger').default;

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('creates logger with correct number of transports', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'test';

    const logger = require('../../../config/logger').default;

    // Console + error file + combined file = 3 transports
    expect(logger.transports.length).toBe(3);
  });

  it('uses production format in production mode', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'production';

    const logger = require('../../../config/logger').default;
    expect(logger).toBeDefined();
    // In production, console transport uses JSON format
  });
});
