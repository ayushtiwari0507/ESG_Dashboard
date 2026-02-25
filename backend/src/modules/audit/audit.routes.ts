import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import prisma from '../../config/database';

const router = Router();

// GET /api/audit-logs
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const where: any = {};
    if (req.query.table) where.tableName = req.query.table;
    if (req.query.recordId) where.recordId = parseInt(req.query.recordId as string);
    if (req.query.userId) where.changedBy = parseInt(req.query.userId as string);

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { changedAt: 'desc' },
      take: 100,
    });

    // Convert BigInt to string for JSON serialization
    const serialized = logs.map(log => ({
      ...log,
      id: log.id.toString(),
    }));

    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
