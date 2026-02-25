import prisma from '../config/database';
import logger from '../config/logger';

class AuditLogger {
  async log(
    tableName: string,
    recordId: number,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    oldValue: object | null,
    newValue: object | null,
    changedBy: number
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tableName,
          recordId,
          action,
          oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
          newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
          changedBy,
        },
      });
      logger.debug(`Audit log: ${action} on ${tableName}#${recordId} by user#${changedBy}`);
    } catch (err) {
      logger.error('Failed to write audit log', { tableName, recordId, action, error: err });
    }
  }
}

export const auditLogger = new AuditLogger();
