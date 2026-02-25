import app from './app';
import { config } from './config/env';
import logger from './config/logger';

const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 ESG Backend server running on port ${PORT}`);
  logger.info(`📊 Environment: ${config.nodeEnv}`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/api/health`);
});
