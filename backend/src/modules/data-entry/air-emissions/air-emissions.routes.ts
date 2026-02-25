import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createAirEmissionsSchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  soxKg: z.number().min(0).optional(),
  noxKg: z.number().min(0).optional(),
  pmKg: z.number().min(0).optional(),
  vocKg: z.number().min(0).optional(),
  stackId: z.string().max(50).optional(),
});

const router = Router();

// GET /api/data/air-emissions
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);

    const data = await prisma.airEmissionsData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch air emissions data' });
  }
});

// POST /api/data/air-emissions
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createAirEmissionsSchema), async (req, res) => {
  try {
    const record = await prisma.airEmissionsData.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        soxKg: req.body.soxKg,
        noxKg: req.body.noxKg,
        pmKg: req.body.pmKg,
        vocKg: req.body.vocKg,
        stackId: req.body.stackId,
        enteredBy: req.user!.sub,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('air_emissions_data', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Air emissions data already exists for this site/month/year/stack' });
      return;
    }
    res.status(500).json({ error: 'Failed to create air emissions data' });
  }
});

// PUT /api/data/air-emissions/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.airEmissionsData.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.airEmissionsData.update({
      where: { id },
      data: {
        soxKg: req.body.soxKg ?? oldRecord.soxKg,
        noxKg: req.body.noxKg ?? oldRecord.noxKg,
        pmKg: req.body.pmKg ?? oldRecord.pmKg,
        vocKg: req.body.vocKg ?? oldRecord.vocKg,
        stackId: req.body.stackId ?? oldRecord.stackId,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('air_emissions_data', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Air emissions data not found' }); return; }
    res.status(500).json({ error: 'Failed to update air emissions data' });
  }
});

// DELETE /api/data/air-emissions/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const record = await prisma.airEmissionsData.findUniqueOrThrow({ where: { id } });
    await prisma.airEmissionsData.delete({ where: { id } });
    await auditLogger.log('air_emissions_data', id, 'DELETE', record, null, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Air emissions data not found' }); return; }
    res.status(500).json({ error: 'Failed to delete air emissions data' });
  }
});

export default router;
