import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import prisma from '../../config/database';

const router = Router();

// GET /api/dashboard/summary?siteId=&year=
router.get('/summary', authenticate, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;

    const siteFilter = siteId ? { siteId } : {};

    // Production totals
    const productionAgg = await prisma.productionData.aggregate({
      where: { year, ...siteFilter },
      _sum: { quantityMt: true },
    });
    const productionTotal = Number(productionAgg._sum.quantityMt) || 0;

    // Energy totals
    const energyAgg = await prisma.energyData.aggregate({
      where: { year, ...siteFilter },
      _sum: {
        totalEnergyGj: true,
        electricityKwh: true,
        renewableKwh: true,
      },
    });
    const totalEnergyGj = Number(energyAgg._sum.totalEnergyGj) || 0;
    const totalElectricityKwh = Number(energyAgg._sum.electricityKwh) || 0;
    const totalRenewableKwh = Number(energyAgg._sum.renewableKwh) || 0;

    // Water totals
    const waterAgg = await prisma.waterData.aggregate({
      where: { year, ...siteFilter },
      _sum: {
        freshWaterKl: true,
        recycledWaterKl: true,
        totalConsumptionKl: true,
      },
    });
    const totalWaterKl = Number(waterAgg._sum.totalConsumptionKl) || 
                         (Number(waterAgg._sum.freshWaterKl) || 0) + (Number(waterAgg._sum.recycledWaterKl) || 0);

    // Waste totals
    const wasteAgg = await prisma.wasteData.aggregate({
      where: { year, ...siteFilter },
      _sum: { quantityMt: true },
    });
    const totalWasteMt = Number(wasteAgg._sum.quantityMt) || 0;

    const recycledWaste = await prisma.wasteData.aggregate({
      where: { year, ...siteFilter, disposalMethod: 'recycled' },
      _sum: { quantityMt: true },
    });
    const recycledWasteMt = Number(recycledWaste._sum.quantityMt) || 0;

    // GHG totals by scope
    const ghgByScope = await prisma.gHGEmission.groupBy({
      by: ['scope'],
      where: { year, ...siteFilter },
      _sum: { co2eTonnes: true },
    });

    const scopeTotals: Record<string, number> = {};
    ghgByScope.forEach(s => {
      scopeTotals[s.scope] = Number(s._sum.co2eTonnes) || 0;
    });

    const totalScope1 = scopeTotals['scope_1'] || 0;
    const totalScope2 = scopeTotals['scope_2'] || 0;
    const totalScope3 = scopeTotals['scope_3'] || 0;
    const totalGroupEmissions = totalScope1 + totalScope2 + totalScope3;

    // Calculate intensities
    const carbonIntensity = productionTotal > 0 ? totalGroupEmissions / productionTotal : 0;
    const energyIntensity = productionTotal > 0 ? totalEnergyGj / productionTotal : 0;
    const waterIntensity = productionTotal > 0 ? totalWaterKl / productionTotal : 0;
    const wasteIntensity = productionTotal > 0 ? totalWasteMt / productionTotal : 0;
    const renewableEnergyPct = totalElectricityKwh > 0 
      ? (totalRenewableKwh / (totalElectricityKwh + totalRenewableKwh)) * 100 : 0;
    const recoveryPct = totalWasteMt > 0 ? (recycledWasteMt / totalWasteMt) * 100 : 0;

    res.json({
      year,
      siteId: siteId || 'all',
      totalScope1: parseFloat(totalScope1.toFixed(2)),
      totalScope2: parseFloat(totalScope2.toFixed(2)),
      totalScope3: parseFloat(totalScope3.toFixed(2)),
      totalGroupEmissions: parseFloat(totalGroupEmissions.toFixed(2)),
      carbonIntensity: parseFloat(carbonIntensity.toFixed(4)),
      energyIntensity: parseFloat(energyIntensity.toFixed(4)),
      waterIntensity: parseFloat(waterIntensity.toFixed(4)),
      wasteIntensity: parseFloat(wasteIntensity.toFixed(4)),
      renewableEnergyPct: parseFloat(renewableEnergyPct.toFixed(1)),
      recoveryPct: parseFloat(recoveryPct.toFixed(1)),
      productionTotal: parseFloat(productionTotal.toFixed(2)),
      totalEnergyGj: parseFloat(totalEnergyGj.toFixed(2)),
      totalWaterKl: parseFloat(totalWaterKl.toFixed(2)),
      totalWasteMt: parseFloat(totalWasteMt.toFixed(2)),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to compute dashboard summary' });
  }
});

// GET /api/dashboard/site-comparison?year=
router.get('/site-comparison', authenticate, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const sites = await prisma.site.findMany({ where: { isActive: true } });

    const comparisons = await Promise.all(
      sites.map(async (site) => {
        const energy = await prisma.energyData.aggregate({
          where: { siteId: site.id, year },
          _sum: { totalEnergyGj: true },
        });
        const production = await prisma.productionData.aggregate({
          where: { siteId: site.id, year },
          _sum: { quantityMt: true },
        });
        const ghg = await prisma.gHGEmission.aggregate({
          where: { siteId: site.id, year },
          _sum: { co2eTonnes: true },
        });

        return {
          siteId: site.id,
          siteName: site.name,
          siteCode: site.code,
          totalEnergyGj: Number(energy._sum.totalEnergyGj) || 0,
          productionMt: Number(production._sum.quantityMt) || 0,
          totalEmissions: Number(ghg._sum.co2eTonnes) || 0,
        };
      })
    );

    res.json(comparisons);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute site comparison' });
  }
});

// GET /api/dashboard/emissions-trend?siteId=&year=
router.get('/emissions-trend', authenticate, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;

    const energyByMonth = await prisma.energyData.findMany({
      where: { year, ...(siteId ? { siteId } : {}) },
      select: { month: true, totalEnergyGj: true, electricityKwh: true, renewableKwh: true },
      orderBy: { month: 'asc' },
    });

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const trend = months.map(m => {
      const entries = energyByMonth.filter(e => e.month === m);
      return {
        month: m,
        totalEnergyGj: entries.reduce((sum, e) => sum + Number(e.totalEnergyGj || 0), 0),
        electricityKwh: entries.reduce((sum, e) => sum + Number(e.electricityKwh || 0), 0),
        renewableKwh: entries.reduce((sum, e) => sum + Number(e.renewableKwh || 0), 0),
      };
    });

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute emissions trend' });
  }
});

export default router;
