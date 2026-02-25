import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import prisma from '../../config/database';

const router = Router();

// GET /api/sites - List all sites
router.get('/', authenticate, async (req, res) => {
  try {
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(sites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// GET /api/sites/:id - Get site details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: parseInt(req.params.id as string, 10) },
    });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    res.json(site);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

export default router;
