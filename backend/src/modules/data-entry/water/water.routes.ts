import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createWaterSchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  freshWaterKl: z.number().min(0).default(0),
  recycledWaterKl: z.number().min(0).default(0),
  dischargeKl: z.number().min(0).default(0),
});

const router = Router();

// GET /api/data/water
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);

    const data = await prisma.waterData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch water data' });
  }
});

// POST /api/data/water
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createWaterSchema), async (req, res) => {
  try {
    const totalConsumptionKl = req.body.freshWaterKl + req.body.recycledWaterKl - req.body.dischargeKl;
    const record = await prisma.waterData.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        freshWaterKl: req.body.freshWaterKl,
        recycledWaterKl: req.body.recycledWaterKl,
        dischargeKl: req.body.dischargeKl,
        totalConsumptionKl: Math.max(0, totalConsumptionKl),
        enteredBy: req.user!.sub,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('water_data', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Water data already exists for this site/month/year' });
      return;
    }
    res.status(500).json({ error: 'Failed to create water data' });
  }
});

// PUT /api/data/water/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.waterData.findUniqueOrThrow({ where: { id } });
    const freshWaterKl = req.body.freshWaterKl ?? Number(oldRecord.freshWaterKl);
    const recycledWaterKl = req.body.recycledWaterKl ?? Number(oldRecord.recycledWaterKl);
    const dischargeKl = req.body.dischargeKl ?? Number(oldRecord.dischargeKl);
    const totalConsumptionKl = freshWaterKl + recycledWaterKl - dischargeKl;

    const updated = await prisma.waterData.update({
      where: { id },
      data: { freshWaterKl, recycledWaterKl, dischargeKl, totalConsumptionKl: Math.max(0, totalConsumptionKl) },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('water_data', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Water data not found' }); return; }
    res.status(500).json({ error: 'Failed to update water data' });
  }
});

export default router;
