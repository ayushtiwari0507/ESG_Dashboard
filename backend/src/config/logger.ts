import winston from 'winston';
import { config } from './env';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'esg-backend' },
  transports: [
    // Console — always enabled
    new winston.transports.Console({
      format:
        config.nodeEnv === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
    }),
    // Error-only file (10 MB rotation, 5 files)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    // Combined log (all levels, 10 MB rotation, 5 files)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

export default logger;
