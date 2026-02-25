import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is required'); })(),
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@esg.local',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'System Administrator',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
