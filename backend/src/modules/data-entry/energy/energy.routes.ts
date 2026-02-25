import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { createEnergySchema } from './energy.schema';
import { energyService } from './energy.service';

const router = Router();

// GET /api/data/energy
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), async (req, res) => {
  try {
    const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await energyService.list(siteId, month, year);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch energy data' });
  }
});

// POST /api/data/energy
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createEnergySchema), async (req, res) => {
  try {
    const record = await energyService.create(req.body, req.user!.sub);
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Energy data already exists for this site/month/year' });
      return;
    }
    res.status(500).json({ error: 'Failed to create energy data' });
  }
});

// PUT /api/data/energy/:id
router.put('/:id', authenticate, authorize('admin', 'site_user'), async (req, res) => {
  try {
    const record = await energyService.update(parseInt(req.params.id as string), req.body, req.user!.sub);
    res.json(record);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Energy data not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update energy data' });
  }
});

// DELETE /api/data/energy/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await energyService.delete(parseInt(req.params.id as string), req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Energy data not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete energy data' });
  }
});

export default router;
