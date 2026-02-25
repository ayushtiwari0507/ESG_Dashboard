import { useEffect, useState } from 'react';
import api from '../api/client';

interface AuditEntry {
  id: string;
  tableName: string;
  recordId: number;
  action: string;
  oldValue: any;
  newValue: any;
  changedAt: string;
  user: { fullName: string; email: string };
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit-logs')
      .then(res => setLogs(res.data))
      .catch(err => console.error('Failed to fetch audit logs:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Audit Log</h1>
      <p className="text-dark-400 mb-8">Immutable record of all data changes</p>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left text-xs font-medium text-dark-400 uppercase py-3 px-4">Time</th>
                <th className="text-left text-xs font-medium text-dark-400 uppercase py-3 px-4">User</th>
                <th className="text-left text-xs font-medium text-dark-400 uppercase py-3 px-4">Action</th>
                <th className="text-left text-xs font-medium text-dark-400 uppercase py-3 px-4">Table</th>
                <th className="text-left text-xs font-medium text-dark-400 uppercase py-3 px-4">Record</th>
                <th className="text-left text-xs font-medium text-dark-400 uppercase py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-dark-400 py-8">No audit logs yet</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-dark-300">
                      {new Date(log.changedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-white">{log.user.fullName}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        log.action === 'INSERT' ? 'bg-primary-500/20 text-primary-400' :
                        log.action === 'UPDATE' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-300 font-mono">{log.tableName}</td>
                    <td className="py-3 px-4 text-sm text-dark-300">#{log.recordId}</td>
                    <td className="py-3 px-4 text-sm text-dark-500">
                      {log.newValue ? `${Object.keys(log.newValue).length} fields` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
