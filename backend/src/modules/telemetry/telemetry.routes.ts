import { Router, Request, Response } from 'express';
import logger from '../../config/logger';

const router = Router();

// POST /api/telemetry/error — receive frontend error reports
router.post('/error', (req: Request, res: Response) => {
  const { message, stack, componentStack, url, userAgent, timestamp } = req.body;

  logger.error('Frontend error report', {
    type: 'frontend-error',
    message,
    stack,
    componentStack,
    url,
    userAgent,
    timestamp: timestamp || new Date().toISOString(),
  });

  res.status(204).send();
});

// POST /api/telemetry/vitals — receive web-vitals performance metrics
router.post('/vitals', (req: Request, res: Response) => {
  const { name, value, id, navigationType, rating } = req.body;

  logger.info('Web vital metric', {
    type: 'web-vital',
    metric: name,
    value,
    id,
    navigationType,
    rating,
  });

  res.status(204).send();
});

export default router;
