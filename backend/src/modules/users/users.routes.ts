import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { auditLogger } from '../../middleware/auditLogger';

const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(150),
  role: z.enum(['admin', 'site_user', 'viewer']).default('viewer'),
  isActive: z.boolean().default(true),
  siteIds: z.array(z.number().int().positive()).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  fullName: z.string().min(1).max(150).optional(),
  role: z.enum(['admin', 'site_user', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
  siteIds: z.array(z.number().int().positive()).optional(),
});

const router = Router();

// Apply admin-only auth to all user management routes
router.use(authenticate, authorize('admin'));

// GET /api/users - List all users
router.get('/', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userSites: {
          select: {
            siteId: true,
            site: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userSites: {
          select: {
            siteId: true,
            site: { select: { name: true, code: true } },
          },
        },
      },
    });
    res.json(user);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'User not found' }); return; }
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users - Create user
router.post('/', validate(createUserSchema), async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const { siteIds, password, ...userData } = req.body;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          ...userData,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (siteIds && siteIds.length > 0) {
        await tx.userSite.createMany({
          data: siteIds.map((siteId: number) => ({
            userId: created.id,
            siteId,
          })),
        });
      }

      return created;
    });

    await auditLogger.log('users', user.id, 'INSERT', null, { ...user, siteIds }, req.user!.sub);
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', validate(updateUserSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const oldUser = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: { userSites: { select: { siteId: true } } },
    });

    const { siteIds, password, ...updateData } = req.body;

    if (password) {
      (updateData as any).passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      if (siteIds !== undefined) {
        await tx.userSite.deleteMany({ where: { userId: id } });
        if (siteIds.length > 0) {
          await tx.userSite.createMany({
            data: siteIds.map((siteId: number) => ({ userId: id, siteId })),
          });
        }
      }

      return updated;
    });

    await auditLogger.log('users', id, 'UPDATE',
      { ...oldUser, passwordHash: '[redacted]' },
      { ...user, siteIds },
      req.user!.sub
    );
    res.json(user);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'User not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'Email already in use' }); return; }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Deactivate user (soft-delete)
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (id === req.user!.sub) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }
    const oldUser = await prisma.user.findUniqueOrThrow({ where: { id } });
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    await auditLogger.log('users', id, 'DELETE', { isActive: true }, { isActive: false }, req.user!.sub);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'User not found' }); return; }
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

export default router;
