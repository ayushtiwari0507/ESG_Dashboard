import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';
import prisma from '../../../config/database';
import { auditLogger } from '../../../middleware/auditLogger';

const createGhgSchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  scope: z.enum(['scope_1', 'scope_2', 'scope_3']),
  scope1Category: z.enum(['stationary', 'mobile', 'process', 'fugitive']).optional(),
  scope2Method: z.enum(['location_based', 'market_based']).optional(),
  scope3Category: z.enum([
    'purchased_goods', 'capital_goods', 'fuel_energy', 'upstream_transport',
    'waste_operations', 'business_travel', 'employee_commuting', 'upstream_leased',
    'downstream_transport', 'processing_sold', 'use_of_sold', 'end_of_life',
    'downstream_leased', 'franchises', 'investments',
  ]).optional(),
  sourceDescription: z.string().max(255),
  activityData: z.number().min(0),
  activityUnitId: z.number().int().positive(),
  emissionFactorId: z.number().int().positive(),
  co2Tonnes: z.number().min(0).optional(),
  ch4Tonnes: z.number().min(0).optional(),
  n2oTonnes: z.number().min(0).optional(),
  co2eTonnes: z.number().min(0),
});

const router = Router();

// GET /api/data/ghg
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.siteId) where.siteId = parseInt(req.query.siteId as string);
    if (req.query.month) where.month = parseInt(req.query.month as string);
    if (req.query.year) where.year = parseInt(req.query.year as string);
    if (req.query.scope) where.scope = req.query.scope as string;

    const data = await prisma.gHGEmission.findMany({
      where,
      include: {
        site: { select: { name: true, code: true } },
        activityUnit: { select: { name: true, category: true } },
        emissionFactor: { select: { name: true, factorValue: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GHG data' });
  }
});

// POST /api/data/ghg
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createGhgSchema), async (req, res) => {
  try {
    const record = await prisma.gHGEmission.create({
      data: {
        siteId: req.body.siteId,
        month: req.body.month,
        year: req.body.year,
        scope: req.body.scope,
        scope1Category: req.body.scope1Category,
        scope2Method: req.body.scope2Method,
        scope3Category: req.body.scope3Category,
        sourceDescription: req.body.sourceDescription,
        activityData: req.body.activityData,
        activityUnitId: req.body.activityUnitId,
        emissionFactorId: req.body.emissionFactorId,
        co2Tonnes: req.body.co2Tonnes,
        ch4Tonnes: req.body.ch4Tonnes,
        n2oTonnes: req.body.n2oTonnes,
        co2eTonnes: req.body.co2eTonnes,
        enteredBy: req.user!.sub,
      },
      include: {
        site: { select: { name: true, code: true } },
        activityUnit: { select: { name: true } },
        emissionFactor: { select: { name: true } },
      },
    });
    await auditLogger.log('ghg_emissions', record.id, 'INSERT', null, record, req.user!.sub);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create GHG data' });
  }
});

// PUT /api/data/ghg/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldRecord = await prisma.gHGEmission.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.gHGEmission.update({
      where: { id },
      data: {
        scope: req.body.scope ?? oldRecord.scope,
        scope1Category: req.body.scope1Category ?? oldRecord.scope1Category,
        scope2Method: req.body.scope2Method ?? oldRecord.scope2Method,
        scope3Category: req.body.scope3Category ?? oldRecord.scope3Category,
        sourceDescription: req.body.sourceDescription ?? oldRecord.sourceDescription,
        activityData: req.body.activityData ?? oldRecord.activityData,
        activityUnitId: req.body.activityUnitId ?? oldRecord.activityUnitId,
        emissionFactorId: req.body.emissionFactorId ?? oldRecord.emissionFactorId,
        co2Tonnes: req.body.co2Tonnes ?? oldRecord.co2Tonnes,
        ch4Tonnes: req.body.ch4Tonnes ?? oldRecord.ch4Tonnes,
        n2oTonnes: req.body.n2oTonnes ?? oldRecord.n2oTonnes,
        co2eTonnes: req.body.co2eTonnes ?? oldRecord.co2eTonnes,
      },
      include: {
        site: { select: { name: true, code: true } },
        activityUnit: { select: { name: true } },
        emissionFactor: { select: { name: true } },
      },
    });
    await auditLogger.log('ghg_emissions', id, 'UPDATE', oldRecord, updated, req.user!.sub);
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'GHG data not found' }); return; }
    res.status(500).json({ error: 'Failed to update GHG data' });
  }
});

// DELETE /api/data/ghg/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const record = await prisma.gHGEmission.findUniqueOrThrow({ where: { id } });
    await prisma.gHGEmission.delete({ where: { id } });
    await auditLogger.log('ghg_emissions', id, 'DELETE', record, null, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'GHG data not found' }); return; }
    res.status(500).json({ error: 'Failed to delete GHG data' });
  }
});

export default router;
