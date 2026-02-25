# Database Debugging Guide

## Technology Context

| Component | Technology | Why |
|-----------|-----------|-----|
| Database | **PostgreSQL 16** | ACID-compliant, supports advanced aggregation queries (window functions, CTEs) needed for dashboard analytics. MVCC concurrency handles simultaneous data entry without lock contention. |
| ORM | **Prisma 6.x** | Schema-as-code via `schema.prisma`. Migrations are auto-generated SQL. The typed client prevents SQL injection (all queries are parameterized). |
| Container image | **postgres:16-alpine** | 80 MB image (vs 400 MB full Debian). Alpine has fewer packages = smaller attack surface. |
| Data persistence | **Docker named volume** | `postgres_data` volume survives container restarts. Named volumes avoid permission issues that bind mounts have on macOS/Windows. |

> **Prisma Error Codes**: Prisma wraps PostgreSQL errors into predictable codes. The most common: `P2002` = unique constraint violation, `P2025` = record not found, `P2003` = foreign key violation, `P2024` = connection pool timeout. Always check the Prisma error code before looking at raw PostgreSQL logs.

> **Schema Location**: The single source of truth for the database schema is `backend/prisma/schema.prisma`. All tables, indexes, relations, and enums are defined there. Run `npx prisma migrate dev` after any schema change.

## Quick Diagnostic Checklist

- [ ] Is the DB container running? → `docker compose ps db`
- [ ] Can you connect? → `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB`
- [ ] Are migrations applied? → `docker compose exec backend npx prisma migrate status`
- [ ] Is data seeded? → `SELECT count(*) FROM users;`

## Debugging Steps

### 1. Check Container Health

```bash
docker compose ps db
# Must show "healthy"

docker compose logs db --tail 50
```

### 2. Connect to Database

```bash
# Interactive psql session
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB

# One-off query
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT version()"
```

### 3. Inspect Schema

```sql
-- List all tables
\dt

-- Describe a table
\d users
\d energy_data

-- Count rows in all data tables
SELECT 'users' as tbl, count(*) FROM users
UNION ALL SELECT 'sites', count(*) FROM sites
UNION ALL SELECT 'energy_data', count(*) FROM energy_data;
```

### 4. Prisma Migration Issues

```bash
# Check migration status
docker compose exec backend npx prisma migrate status

# Apply pending migrations
docker compose exec backend npx prisma migrate deploy

# Reset database (DESTRUCTIVE — dev only)
docker compose exec backend npx prisma migrate reset --force

# Generate client after schema changes
docker compose exec backend npx prisma generate
```

### 5. Seed Data

```bash
# Run seed script
docker compose exec backend npx tsx prisma/seed.ts

# Verify admin user
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT id, email, role, is_active FROM users"
```

### 6. Connection Pool Issues

**Symptom**: `Too many clients` or `connection refused`

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections (be careful)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND pid <> pg_backend_pid();
```

Prisma connection pool is managed automatically. If overloaded:
- Check if multiple backend instances are running
- Increase `connection_limit` in `DATABASE_URL`:
  ```
  postgresql://user:pass@db:5432/esg?connection_limit=20
  ```

### 7. Performance

```sql
-- Slow query identification
SELECT query, calls, mean_exec_time, total_exec_time 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- Check index usage
SELECT indexrelname, idx_scan, idx_tup_read 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) 
FROM pg_catalog.pg_statio_user_tables 
ORDER BY pg_total_relation_size(relid) DESC;
```

### 8. Backup & Restore

```bash
# Backup
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# Restore
cat backup.sql | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
```

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `FATAL: password authentication failed` | Wrong credentials in `.env` | Check `POSTGRES_USER`, `DB_PASSWORD` in `.env` |
| `relation "users" does not exist` | Migrations not applied | `npx prisma migrate deploy` |
| `P2002 Unique constraint violation` | Duplicate entry | Check unique fields before insert |
| `P2025 Record not found` | ID doesn't exist | Verify ID in request params |
| DB container won't start | Corrupt volume | `docker compose down -v` (DESTRUCTIVE) then restart |
| Slow queries | Missing indexes | Check `@@index` in `schema.prisma`, add if needed |
