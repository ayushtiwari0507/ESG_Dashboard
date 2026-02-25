# Logging & Monitoring Guide

## Technology Context

| Component | Technology | Why |
|-----------|-----------|-----|
| Application Logger | **Winston 3.x** | Multi-transport architecture: console (colorized in dev, JSON in prod) + file (with rotation). Configurable log levels. Single logger instance shared across the entire backend. |
| HTTP Logger | **Morgan 1.x** | Express middleware that logs every HTTP request (method, URL, status, response time). Piped through Winston so HTTP logs appear in the same log files with consistent formatting. |
| Audit Logger | **Custom `AuditLogger` class** | Writes to PostgreSQL `audit_logs` table. Records every INSERT/UPDATE/DELETE with user ID, table name, action, and before/after data snapshots. Provides compliance audit trail for ESG reporting. |
| Frontend Telemetry | **ErrorBoundary + Web Vitals** | React's `ErrorBoundary` catches unhandled component errors and POSTs them to `/api/telemetry/error`. Web Vitals (LCP, FID, CLS) can be sent to `/api/telemetry/vitals` for performance monitoring. |
| Log Rotation | **Winston file transport + Docker JSON driver** | Both application logs (Winston) and container stdout (Docker) rotate at 10 MB with 5 retained files. Prevents disk exhaustion without losing recent history. |

> **Why Winston over Pino?** Winston's multi-transport system (file + console + rotation) is more flexible for our needs. Pino is faster but requires external tools for file rotation. Winston also supports colorized output in development, which improves the developer experience.

> **Why audit to database (not log files)?** Audit trail data needs to be queryable ("show all changes by user X to energy data in January"). SQL queries on a `audit_logs` table are far more practical than grep on log files. The audit trail is also retained independently of log rotation.

## Logging Architecture

```
Frontend (React) ──→ POST /api/telemetry/error ──→ Winston ──→ logs/error.log
                 ──→ POST /api/telemetry/vitals ──→ Winston ──→ logs/combined.log
                                                              ──→ Console (stdout)

Backend (Express) ─→ Morgan (HTTP) ──────────────→ Winston ──→ logs/combined.log
                  ─→ Application logs ────────────→           ──→ logs/error.log
                  ─→ Audit logger ────────────────→ PostgreSQL (audit_logs table)
```

## Log Locations

| Location | Contents | Rotation |
|---|---|---|
| `logs/combined.log` | All log levels (info, warn, error, debug) | 10 MB, 5 files |
| `logs/error.log` | Errors only | 10 MB, 5 files |
| Console (stdout) | All levels (colorized in dev, JSON in prod) | Docker log rotation |
| `audit_logs` table | Data mutations (INSERT/UPDATE/DELETE) | Database |

## Viewing Logs

### Real-time

```bash
# Docker logs (stdout)
docker compose logs -f backend

# File logs inside container
docker compose exec backend tail -f logs/combined.log
docker compose exec backend tail -f logs/error.log
```

### Searching Logs

```bash
# Search for specific error
docker compose exec backend grep "PrismaClient" logs/error.log

# Search by timestamp range
docker compose exec backend grep "2025-01-15T1[0-2]" logs/combined.log

# JSON log parsing with jq
docker compose exec backend cat logs/combined.log | jq 'select(.level == "error")'
```

### Audit Trail

```sql
-- Recent audit entries
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;

-- All changes by a specific user
SELECT * FROM audit_logs WHERE user_id = 1 ORDER BY created_at DESC;

-- All changes to energy data
SELECT * FROM audit_logs WHERE table_name = 'energy_data' ORDER BY created_at DESC;
```

## Log Levels

| Level | Usage |
|---|---|
| `error` | Unhandled exceptions, DB failures, critical issues |
| `warn` | Failed login attempts, validation failures, deprecation warnings |
| `info` | User logins, HTTP requests (Morgan), CRUD operations |
| `debug` | Detailed diagnostic info (disabled in production by default) |

Set via `LOG_LEVEL` environment variable in `.env`.

## Frontend Telemetry

### Error Reports

The `ErrorBoundary` component catches unhandled React errors and posts them to:

```
POST /api/telemetry/error
{
  "message": "Cannot read property 'x' of undefined",
  "stack": "TypeError: ...",
  "componentStack": "at Dashboard > at ProtectedRoute > at App",
  "url": "http://localhost:3000/dashboard",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Web Vitals (Optional)

Performance metrics can be sent to:

```
POST /api/telemetry/vitals
{
  "name": "LCP",
  "value": 1500,
  "rating": "good",
  "id": "v3-1234",
  "navigationType": "navigate"
}
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No log files created | `logs/` directory missing | Create `logs/` dir in backend root |
| Logs not rotating | File size under 10 MB | Wait or reduce `maxsize` for testing |
| Docker logs growing large | Log rotation not configured | Check `docker-compose.yml` logging config |
| Audit logs missing | `auditLogger.log()` not called | Check route handlers call audit logger |
| Frontend errors not reported | ErrorBoundary not wrapped | Verify `<ErrorBoundary>` wraps `<App>` |
