# Backend Debugging Guide

## Technology Context

| Component | Technology | Why |
|-----------|-----------|-----|
| HTTP Framework | **Express.js 4.x** | Largest middleware ecosystem (cors, morgan, rate-limit). Simple middleware chain makes debugging predictable — requests flow linearly through authenticate → authorize → validate → handler → errorHandler. See [ARCHITECTURE.md](../Docs/ARCHITECTURE.md) for full rationale. |
| ORM | **Prisma 6.x** | Type-safe database access. Errors like `P2002` (unique constraint) and `P2025` (record not found) are predictable Prisma error codes, not raw SQL errors. |
| Validation | **Zod 3.x** | Request validation with typed error responses. 400 errors always include a `details` array with field-level messages. |
| Auth | **JWT (jsonwebtoken)** | Stateless tokens — no session store to debug. Decode any token at [jwt.io](https://jwt.io) to inspect claims. |
| Logging | **Winston + Morgan** | All HTTP requests logged via Morgan → Winston pipeline. Application logs go through Winston. Both write to `logs/combined.log` and `logs/error.log`. |

> **Tip**: The backend middleware chain processes requests in this order: Rate Limiter → Morgan → CORS → JSON Parser → authenticate → authorize → validate → Route Handler → Error Handler. When debugging, identify which layer is producing the error by checking the HTTP status code (401 = auth, 403 = authz, 400 = validation, 500 = handler/DB).

## Quick Diagnostic Checklist

- [ ] Is the backend container running? → `docker compose ps backend`
- [ ] Are there startup errors? → `docker compose logs backend --tail 50`
- [ ] Can you reach the health endpoint? → `curl http://localhost:4000/api/health`
- [ ] Is the DB connection healthy? → Check logs for `Prisma` errors

## Debugging Steps

### 1. Check Service Health

```bash
# Container status
docker compose ps

# Health endpoint
curl -s http://localhost:4000/api/health | jq .

# Expected: {"status":"ok","timestamp":"..."}
```

### 2. View Logs

```bash
# Real-time backend logs
docker compose logs -f backend

# Last 100 lines
docker compose logs backend --tail 100

# Log files inside container
docker compose exec backend cat logs/error.log
docker compose exec backend cat logs/combined.log
```

### 3. Auth / JWT Issues

**Symptom**: 401 Unauthorized on all requests

| Check | Command |
|---|---|
| Token format | Ensure `Authorization: Bearer <token>` header |
| Token expiry | Decode at jwt.io — check `exp` claim |
| JWT_SECRET mismatch | Compare `.env` JWT_SECRET with the one used in container |
| User active? | `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT id, email, is_active FROM users"` |

```bash
# Test login
curl -X POST http://localhost:4000/api/2026-02-24/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@esg.local","password":"<your-password>"}'

# Use returned token
curl http://localhost:4000/api/2026-02-24/auth/me \
  -H "Authorization: Bearer <access-token>"
```

### 4. Prisma / Database Connection

**Symptom**: 500 errors, "PrismaClientKnownRequestError"

```bash
# Check DATABASE_URL
docker compose exec backend printenv DATABASE_URL

# Test DB connectivity from backend container
docker compose exec backend npx prisma db execute --stdin <<< "SELECT 1"

# Check pending migrations
docker compose exec backend npx prisma migrate status
```

### 5. Validation Errors (400)

Zod validates all request bodies. Check the response `details` array:

```json
{
  "error": "Validation error",
  "details": [
    { "field": "email", "message": "Invalid email" }
  ]
}
```

### 6. Rate Limiting (429)

- Auth login: 10 requests / 15 min
- All API: 200 requests / 1 min

```bash
# Check current limits in response headers
curl -i http://localhost:4000/api/health
# Look for: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset
```

### 7. Attach Debugger

```bash
# Run backend with Node.js inspector
docker compose exec backend node --inspect=0.0.0.0:9229 dist/index.js

# Then attach VS Code debugger to localhost:9229
```

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '@prisma/client'` | Prisma client not generated | `npx prisma generate` |
| `P2002 Unique constraint failed` | Duplicate record | Check unique fields (email, site code) |
| `connect ECONNREFUSED` | DB not ready | Wait for healthcheck, check `depends_on` |
| `ENOMEM` | Container OOM | Increase Docker memory limit |
| `EACCES /logs/` | Permission denied | Ensure `logs/` dir writable in container |
