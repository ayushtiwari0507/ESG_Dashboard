import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createEtpSchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  codMgPerL: z.number().min(0).optional(),
  bodMgPerL: z.number().min(0).optional(),
  tssMgPerL: z.number().min(0).optional(),
  tdsMgPerL: z.number().min(0).optional(),
  sludgeMt: z.number().min(0).optional(),
});

const router = Router();

// GET /api/data/etp
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);

    const data = await prisma.eTPData.findMany({
      where,
      include: { site: { select: { name: true, code: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ETP data' });
  }
});

// POST /api/data/etp
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createEtpSchema), async (req, res) => {
  try {
    const record = await prisma.eTPData.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        codMgPerL: req.body.codMgPerL,
        bodMgPerL: req.body.bodMgPerL,
        tssMgPerL: req.body.tssMgPerL,
        tdsMgPerL: req.body.tdsMgPerL,
        sludgeMt: req.body.sludgeMt,
        enteredBy: req.user!.sub,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('etp_data', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'ETP data already exists for this site/month/year' });
      return;
    }
    res.status(500).json({ error: 'Failed to create ETP data' });
  }
});

// PUT /api/data/etp/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.eTPData.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.eTPData.update({
      where: { id },
      data: {
        codMgPerL: req.body.codMgPerL ?? oldRecord.codMgPerL,
        bodMgPerL: req.body.bodMgPerL ?? oldRecord.bodMgPerL,
        tssMgPerL: req.body.tssMgPerL ?? oldRecord.tssMgPerL,
        tdsMgPerL: req.body.tdsMgPerL ?? oldRecord.tdsMgPerL,
        sludgeMt: req.body.sludgeMt ?? oldRecord.sludgeMt,
      },
      include: { site: { select: { name: true, code: true } } },
    });
    await auditLogger.log('etp_data', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'ETP data not found' }); return; }
    res.status(500).json({ error: 'Failed to update ETP data' });
  }
});

// DELETE /api/data/etp/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const record = await prisma.eTPData.findUniqueOrThrow({ where: { id } });
    await prisma.eTPData.delete({ where: { id } });
    await auditLogger.log('etp_data', id, 'DELETE', record, null, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'ETP data not found' }); return; }
    res.status(500).json({ error: 'Failed to delete ETP data' });
  }
});

export default router;
