import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createRecoverySchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  materialName: z.string().max(200),
  quantityMt: z.number().min(0),
  revenueLkr: z.number().min(0).optional(),
});

const router = Router();

// GET /api/data/recovery
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);

    const data = await prisma.recoveryData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recovery data' });
  }
});

// POST /api/data/recovery
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createRecoverySchema), async (req, res) => {
  try {
    const record = await prisma.recoveryData.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        materialName: req.body.materialName,
        quantityMt: req.body.quantityMt,
        revenueLkr: req.body.revenueLkr,
        enteredBy: req.user!.sub,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('recovery_data', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create recovery data' });
  }
});

// PUT /api/data/recovery/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.recoveryData.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.recoveryData.update({
      where: { id },
      data: {
        materialName: req.body.materialName ?? oldRecord.materialName,
        quantityMt: req.body.quantityMt ?? oldRecord.quantityMt,
        revenueLkr: req.body.revenueLkr ?? oldRecord.revenueLkr,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('recovery_data', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Recovery data not found' }); return; }
    res.status(500).json({ error: 'Failed to update recovery data' });
  }
});

// DELETE /api/data/recovery/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const record = await prisma.recoveryData.findUniqueOrThrow({ where: { id } });
    await prisma.recoveryData.delete({ where: { id } });
    await auditLogger.log('recovery_data', id, 'DELETE', record, null, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Recovery data not found' }); return; }
    res.status(500).json({ error: 'Failed to delete recovery data' });
  }
});

export default router;
