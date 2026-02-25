import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createWasteSchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  wasteType: z.enum(['hazardous', 'non_hazardous']),
  disposalMethod: z.enum(['recycled', 'co_processed', 'landfilled', 'incinerated', 'other']),
  quantityMt: z.number().min(0),
  description: z.string().max(255).optional(),
});

const router = Router();

// GET /api/data/waste
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);

    const data = await prisma.wasteData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waste data' });
  }
});

// POST /api/data/waste
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createWasteSchema), async (req, res) => {
  try {
    const record = await prisma.wasteData.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        wasteType: req.body.wasteType,
        disposalMethod: req.body.disposalMethod,
        quantityMt: req.body.quantityMt,
        description: req.body.description,
        enteredBy: req.user!.sub,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('waste_data', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create waste data' });
  }
});

// PUT /api/data/waste/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.wasteData.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.wasteData.update({
      where: { id },
      data: {
        wasteType: req.body.wasteType ?? oldRecord.wasteType,
        disposalMethod: req.body.disposalMethod ?? oldRecord.disposalMethod,
        quantityMt: req.body.quantityMt ?? oldRecord.quantityMt,
        description: req.body.description ?? oldRecord.description,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('waste_data', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Waste data not found' }); return; }
    res.status(500).json({ error: 'Failed to update waste data' });
  }
});

// DELETE /api/data/waste/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const record = await prisma.wasteData.findUniqueOrThrow({ where: { id } });
    await prisma.wasteData.delete({ where: { id } });
    await auditLogger.log('waste_data', id, 'DELETE', record, null, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Waste data not found' }); return; }
    res.status(500).json({ error: 'Failed to delete waste data' });
  }
});

export default router;
