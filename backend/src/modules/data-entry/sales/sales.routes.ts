import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createSalesSchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  quantityMt: z.number().min(0),
  revenueLkr: z.number().min(0).optional(),
});

const router = Router();

// GET /api/data/sales
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);

    const data = await prisma.salesData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// POST /api/data/sales
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createSalesSchema), async (req, res) => {
  try {
    const record = await prisma.salesData.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        quantityMt: req.body.quantityMt,
        revenueLkr: req.body.revenueLkr,
        enteredBy: req.user!.sub,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('sales_data', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Sales data already exists for this site/month/year' });
      return;
    }
    res.status(500).json({ error: 'Failed to create sales data' });
  }
});

// PUT /api/data/sales/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.salesData.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.salesData.update({
      where: { id },
      data: {
        quantityMt: req.body.quantityMt ?? oldRecord.quantityMt,
        revenueLkr: req.body.revenueLkr ?? oldRecord.revenueLkr,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('sales_data', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Sales data not found' }); return; }
    res.status(500).json({ error: 'Failed to update sales data' });
  }
});

// DELETE /api/data/sales/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const record = await prisma.salesData.findUniqueOrThrow({ where: { id } });
    await prisma.salesData.delete({ where: { id } });
    await auditLogger.log('sales_data', id, 'DELETE', record, null, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Sales data not found' }); return; }
    res.status(500).json({ error: 'Failed to delete sales data' });
  }
});

export default router;
