import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';
import logger from '../../../config/logger';
import { CreateEnergyInput } from './energy.schema';

// Energy conversion factors to GJ
const CONVERSION_FACTORS = {
  electricityKwh: 0.0036,
  steamMt: 2.76,
  coalMt: 19.6,
  dieselLitres: 0.0358,
  foLitres: 0.0411,
  lpgKg: 0.0494,
  pngScm: 0.0376,
  renewableKwh: 0.0036,
};

function calculateTotalEnergyGJ(data: Partial<CreateEnergyInput>): number {
  return (
    (data.electricityKwh || 0) * CONVERSION_FACTORS.electricityKwh +
    (data.steamMt || 0) * CONVERSION_FACTORS.steamMt +
    (data.coalMt || 0) * CONVERSION_FACTORS.coalMt +
    (data.dieselLitres || 0) * CONVERSION_FACTORS.dieselLitres +
    (data.foLitres || 0) * CONVERSION_FACTORS.foLitres +
    (data.lpgKg || 0) * CONVERSION_FACTORS.lpgKg +
    (data.pngScm || 0) * CONVERSION_FACTORS.pngScm +
    (data.renewableKwh || 0) * CONVERSION_FACTORS.renewableKwh
  );
}

export class EnergyService {
  async list(siteId?: number, month?: number, year?: number) {
    const where: any = {};
    if (siteId) where.siteId = siteId;
    if (month) where.month = month;
    if (year) where.year = year;

    return prisma.energyData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async create(data: CreateEnergyInput, userId: number) {
    const totalEnergyGj = calculateTotalEnergyGJ(data);

    const record = await prisma.energyData.create({
      data: {
        siteId: data.siteId,
        month: data.month,
        year: data.year,
        electricityKwh: data.electricityKwh,
        steamMt: data.steamMt,
        coalMt: data.coalMt,
        dieselLitres: data.dieselLitres,
        foLitres: data.foLitres,
        lpgKg: data.lpgKg,
        pngScm: data.pngScm,
        renewableKwh: data.renewableKwh,
        totalEnergyGj,
        enteredBy: userId,
      },
      include: { site: { select: { name: true, code: true } } },
    });

    await auditLogger.log('energy_data', record.id, 'INSERT', null, record, userId);
    logger.info(`Energy data created for site ${data.siteId}, ${data.month}/${data.year}`);

    return record;
  }

  async update(id: number, data: Partial<CreateEnergyInput>, userId: number) {
    const oldRecord = await prisma.energyData.findUniqueOrThrow({ where: { id } });

    const mergedData = {
      electricityKwh: data.electricityKwh ?? Number(oldRecord.electricityKwh),
      steamMt: data.steamMt ?? Number(oldRecord.steamMt),
      coalMt: data.coalMt ?? Number(oldRecord.coalMt),
      dieselLitres: data.dieselLitres ?? Number(oldRecord.dieselLitres),
      foLitres: data.foLitres ?? Number(oldRecord.foLitres),
      lpgKg: data.lpgKg ?? Number(oldRecord.lpgKg),
      pngScm: data.pngScm ?? Number(oldRecord.pngScm),
      renewableKwh: data.renewableKwh ?? Number(oldRecord.renewableKwh),
    };

    const totalEnergyGj = calculateTotalEnergyGJ(mergedData);

    const updated = await prisma.energyData.update({
      where: { id },
      data: { ...mergedData, totalEnergyGj },
      include: { site: { select: { name: true, code: true } } },
    });

    await auditLogger.log('energy_data', id, 'UPDATE', oldRecord, updated, userId);
    return updated;
  }

  async delete(id: number, userId: number) {
    const record = await prisma.energyData.findUniqueOrThrow({ where: { id } });
    await prisma.energyData.delete({ where: { id } });
    await auditLogger.log('energy_data', id, 'DELETE', record, null, userId);
  }
}

export const energyService = new EnergyService();
