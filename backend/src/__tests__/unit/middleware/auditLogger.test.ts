/**
 * Unit tests for AuditLogger
 */

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Must mock env BEFORE auditLogger imports logger which imports env
jest.mock('../../../config/env', () => ({
  config: {
    port: 4000, nodeEnv: 'test', database: { url: '' },
    jwt: { secret: 'test', expiry: '1h', refreshExpiry: '7d' },
    admin: { email: '', password: '', name: '' },
    logLevel: 'warn',
  },
}));

import { auditLogger } from '../../../middleware/auditLogger';

const prisma = require('../../../config/database').default;
const logger = require('../../../config/logger').default;

describe('AuditLogger', () => {
  beforeEach(() => {
    prisma.auditLog.create.mockResolvedValue({});
    jest.clearAllMocks();
  });

  it('creates audit log entry for INSERT', async () => {
    await auditLogger.log('energy_data', 1, 'INSERT', null, { id: 1 }, 10);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableName: 'energy_data',
        recordId: 1,
        action: 'INSERT',
        oldValue: null,
        newValue: { id: 1 },
        changedBy: 10,
      }),
    });
    expect(logger.debug).toHaveBeenCalled();
  });

  it('creates audit log entry for UPDATE with old and new values', async () => {
    const old = { name: 'old' };
    const upd = { name: 'new' };
    await auditLogger.log('users', 5, 'UPDATE', old, upd, 1);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableName: 'users',
        recordId: 5,
        action: 'UPDATE',
        oldValue: old,
        newValue: upd,
        changedBy: 1,
      }),
    });
  });

  it('creates audit log entry for DELETE', async () => {
    await auditLogger.log('water_data', 3, 'DELETE', { id: 3 }, null, 2);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE',
        oldValue: { id: 3 },
        newValue: null,
      }),
    });
  });

  it('logs error when audit log creation fails', async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error('DB write failed'));

    // Should not throw
    await auditLogger.log('test', 1, 'INSERT', null, {}, 1);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to write audit log',
      expect.objectContaining({ tableName: 'test', error: expect.any(Error) })
    );
  });

  it('serializes values with JSON.parse(JSON.stringify())', async () => {
    const circular: any = { a: 1 };
    // Non-circular object should work fine
    await auditLogger.log('test', 1, 'UPDATE', circular, { b: 2 }, 1);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldValue: { a: 1 },
        newValue: { b: 2 },
      }),
    });
  });
});
