/**
 * Unit tests for EnergyService
 */

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    energyData: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      delete: jest.fn().mockResolvedValue({ id: 1 }),
      findUniqueOrThrow: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock('../../../config/env', () => ({
  config: {
    port: 4000, nodeEnv: 'test', database: { url: '' },
    jwt: { secret: 'test', expiry: '1h', refreshExpiry: '7d' },
    admin: { email: '', password: '', name: '' },
    logLevel: 'warn',
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { EnergyService } from '../../../modules/data-entry/energy/energy.service';

const prisma = require('../../../config/database').default;

describe('EnergyService', () => {
  let service: EnergyService;

  beforeEach(() => {
    service = new EnergyService();
    jest.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({});
  });

  /* ── list ── */
  describe('list', () => {
    it('returns all records with no filters', async () => {
      prisma.energyData.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
      const result = await service.list();
      expect(result).toHaveLength(2);
      expect(prisma.energyData.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {},
      }));
    });

    it('applies siteId filter', async () => {
      prisma.energyData.findMany.mockResolvedValueOnce([]);
      await service.list(1);
      expect(prisma.energyData.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { siteId: 1 },
      }));
    });

    it('applies all filters', async () => {
      prisma.energyData.findMany.mockResolvedValueOnce([]);
      await service.list(1, 6, 2025);
      expect(prisma.energyData.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { siteId: 1, month: 6, year: 2025 },
      }));
    });
  });

  /* ── create ── */
  describe('create', () => {
    it('creates record with calculated totalEnergyGj', async () => {
      const data = {
        siteId: 1, month: 1, year: 2025,
        electricityKwh: 1000, steamMt: 0, coalMt: 0,
        dieselLitres: 0, foLitres: 0, lpgKg: 0,
        pngScm: 0, renewableKwh: 0,
      };
      prisma.energyData.create.mockResolvedValueOnce({ id: 1, ...data, totalEnergyGj: 3.6 });

      const result = await service.create(data, 1);

      expect(prisma.energyData.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          siteId: 1,
          totalEnergyGj: 1000 * 0.0036, // 3.6
          enteredBy: 1,
        }),
      }));
      expect(result.totalEnergyGj).toBe(3.6);
    });

    it('calculates total from multiple fuel types', async () => {
      const data = {
        siteId: 1, month: 1, year: 2025,
        electricityKwh: 100,  // 0.36
        steamMt: 10,          // 27.6
        coalMt: 5,            // 98
        dieselLitres: 100,    // 3.58
        foLitres: 50,         // 2.055
        lpgKg: 20,            // 0.988
        pngScm: 200,          // 7.52
        renewableKwh: 500,    // 1.8
      };
      const expectedTotal =
        100 * 0.0036 + 10 * 2.76 + 5 * 19.6 + 100 * 0.0358 +
        50 * 0.0411 + 20 * 0.0494 + 200 * 0.0376 + 500 * 0.0036;

      prisma.energyData.create.mockResolvedValueOnce({ id: 1, ...data, totalEnergyGj: expectedTotal });

      await service.create(data, 1);

      expect(prisma.energyData.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          totalEnergyGj: expectedTotal,
        }),
      }));
    });

    it('logs audit entry on create', async () => {
      prisma.energyData.create.mockResolvedValueOnce({
        id: 1, siteId: 1, month: 1, year: 2025,
        electricityKwh: 0, steamMt: 0, coalMt: 0, dieselLitres: 0,
        foLitres: 0, lpgKg: 0, pngScm: 0, renewableKwh: 0, totalEnergyGj: 0,
      });

      const data = {
        siteId: 1, month: 1, year: 2025,
        electricityKwh: 0, steamMt: 0, coalMt: 0,
        dieselLitres: 0, foLitres: 0, lpgKg: 0,
        pngScm: 0, renewableKwh: 0,
      };

      await service.create(data, 42);

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  /* ── update ── */
  describe('update', () => {
    const existingRecord = {
      id: 1, siteId: 1, month: 1, year: 2025,
      electricityKwh: 1000, steamMt: 0, coalMt: 0,
      dieselLitres: 0, foLitres: 0, lpgKg: 0,
      pngScm: 0, renewableKwh: 0, totalEnergyGj: 3.6,
    };

    it('updates record and recalculates totalEnergyGj', async () => {
      prisma.energyData.findUniqueOrThrow.mockResolvedValueOnce(existingRecord);
      prisma.energyData.update.mockResolvedValueOnce({ ...existingRecord, electricityKwh: 2000, totalEnergyGj: 7.2 });

      const result = await service.update(1, { electricityKwh: 2000 }, 1);

      expect(prisma.energyData.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          electricityKwh: 2000,
          totalEnergyGj: 2000 * 0.0036,
        }),
      }));
    });

    it('preserves unchanged fields from old record', async () => {
      prisma.energyData.findUniqueOrThrow.mockResolvedValueOnce(existingRecord);
      prisma.energyData.update.mockResolvedValueOnce({ ...existingRecord });

      await service.update(1, { coalMt: 10 }, 1);

      expect(prisma.energyData.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          electricityKwh: 1000, // preserved from old record
          coalMt: 10,           // updated
        }),
      }));
    });

    it('propagates P2025 error when record not found', async () => {
      prisma.energyData.findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
      await expect(service.update(999, {}, 1)).rejects.toEqual({ code: 'P2025' });
    });
  });

  /* ── delete ── */
  describe('delete', () => {
    it('deletes record and logs audit', async () => {
      prisma.energyData.findUniqueOrThrow.mockResolvedValueOnce({ id: 1, siteId: 1 });
      prisma.energyData.delete.mockResolvedValueOnce({});

      await service.delete(1, 42);

      expect(prisma.energyData.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('propagates P2025 error when record not found', async () => {
      prisma.energyData.findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });
      await expect(service.delete(999, 1)).rejects.toEqual({ code: 'P2025' });
    });
  });
});
