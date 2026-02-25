import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { config } from '../../config/env';
import logger from '../../config/logger';
import { LoginInput } from './auth.schema';

export class AuthService {
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { userSites: { select: { siteId: true } } },
    });

    if (!user || !user.isActive) {
      logger.warn(`Failed login attempt for email: ${input.email}`);
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      logger.warn(`Failed login attempt for email: ${input.email}`);
      throw new Error('Invalid credentials');
    }

    const siteIds = user.userSites.map(us => us.siteId);

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        siteIds,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiry } as jwt.SignOptions
    );

    logger.info(`User logged in: ${user.email} (role: ${user.role})`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        siteIds,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userSites: { include: { site: true } } },
    });

    if (!user) throw new Error('User not found');

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      sites: user.userSites.map(us => ({
        id: us.site.id,
        name: us.site.name,
        code: us.site.code,
      })),
    };
  }
}

export const authService = new AuthService();
