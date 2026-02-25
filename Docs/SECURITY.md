# Security Guide

## Table of Contents

- [Overview](#overview)
- [Authentication & Authorization](#authentication--authorization)
- [Credential Management](#credential-management)
- [Credential Scanning (Gitleaks)](#credential-scanning-gitleaks)
- [API Security](#api-security)
- [Database Security](#database-security)
- [Docker Security](#docker-security)
- [Security Checklist](#security-checklist)
- [Incident Response](#incident-response)

---

## Overview

This document covers the security practices, tools, and configurations used in the ESG platform. It explains **what** security measures are in place, **why** each was chosen, and **how** to maintain them.

### Security Principles

1. **Defense in depth** — Multiple layers (auth, validation, rate limiting, audit logging)
2. **Least privilege** — Role-based access (viewer < site_user < admin)
3. **Secrets never in code** — Environment variables + `.gitignore` + credential scanning
4. **Audit everything** — Every data mutation is logged with user, action, and timestamp

---

## Authentication & Authorization

### JWT Authentication

| Setting | Value | Why |
|---------|-------|-----|
| Algorithm | HS256 (HMAC-SHA256) | Symmetric signing — simpler than RSA for single-service architectures. Both signing and verification happen on the same backend server. |
| Secret length | 64+ characters | HMAC security is proportional to key length. 64 bytes exceeds the 256-bit security margin. |
| Access token lifetime | 24 hours | Balances security with UX. Shorter toks (1h) cause constant re-logins for data entry users. Longer toks (30d) increase exposure window. |
| Refresh token lifetime | 7 days | Covers a full work week. Users authenticate Monday morning, work all week without interruption. |
| Token storage | `localStorage` | Simpler than HttpOnly cookies for SPA architecture. Acceptable because XSS is mitigated by React's JSX escaping and no `dangerouslySetInnerHTML` usage. |

### How Auth Works

```
1. POST /api/2026-02-24/auth/login { email, password }
   ↓
2. bcrypt.compare(password, user.passwordHash)  ← timing-safe comparison
   ↓
3. jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '24h' })
   ↓ 
4. Response: { accessToken: "eyJ..." }
   ↓
5. Client stores token, sends: Authorization: Bearer <token>
   ↓
6. authenticate middleware: jwt.verify(token, JWT_SECRET) → req.user
   ↓
7. authorize(['admin', 'site_user']) → checks req.user.role
```

### Role-Based Access Control (RBAC)

| Role | Data Read | Data Create/Edit | Data Delete | User Management | Audit Logs |
|------|-----------|-------------------|-------------|-----------------|------------|
| `viewer` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `site_user` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Why 3 roles?** Maps to organizational reality:
- **Viewers**: Management reviewing dashboards
- **Site users**: Plant operators entering environmental data
- **Admins**: System administrators managing users and data integrity

### Password Security

| Setting | Value | Why |
|---------|-------|-----|
| Hashing algorithm | bcrypt | Purpose-built for password hashing. Intentionally slow (~100ms per hash) to prevent brute force. |
| Salt rounds | 10 | ~100ms per hash. 12+ rounds are significantly slower with negligible security gain for offline attacks against a properly secured database. |
| Minimum length | 8 characters | Enforced by Zod validation schema on registration and user creation. |
| Storage | Hash only | Raw passwords are never stored, logged, or returned in API responses. |

---

## Credential Management

### Environment Variables

All secrets are stored in `.env` files that are:
1. **Generated** by `scripts/setup-env.sh` with cryptographic randomness
2. **Excluded** from version control via `.gitignore`
3. **Protected** with file permissions (`chmod 600 .env` — owner read/write only)
4. **Injected** into Docker containers via `docker-compose.yml` `environment:` blocks

### What Qualifies as a Secret

| Secret | Where Stored | How Generated |
|--------|-------------|---------------|
| `DB_PASSWORD` | `.env` | `openssl rand -base64 32` |
| `JWT_SECRET` | `.env` | `openssl rand -base64 64` |
| `ADMIN_PASSWORD` | `.env` | User-provided (min 8 chars) |
| `POSTGRES_USER` | `.env` | User-provided |

### What's Safe to Commit

| File | Status | Why |
|------|--------|-----|
| `.env.example` | ✅ Safe | Template with placeholder values, no real secrets |
| `docker-compose.yml` | ✅ Safe | References `${VAR}` placeholders, not actual values |
| `setup-env.sh` | ✅ Safe | Generates secrets at runtime, doesn't contain them |
| `.env` | ❌ NEVER commit | Contains actual secrets |
| `logs/` | ❌ NEVER commit | May contain sensitive data in error stacktraces |

---

## Credential Scanning (Gitleaks)

### Why Gitleaks?

| Tool | Language | Speed | False Positive Rate | Pre-commit Support | License |
|------|----------|-------|--------------------|--------------------|---------|
| **Gitleaks** ✅ | Go binary | Fastest | Low | Native | MIT |
| TruffleHog | Go | Fast | Medium | Plugin | AGPL-3.0 |
| detect-secrets | Python | Moderate | High | Plugin | Apache-2.0 |
| git-secrets | Shell | Slow | Low | Native | Apache-2.0 |

**Decision**: Gitleaks was chosen for its **speed** (Go binary, no runtime dependencies), **low false positive rate** (regex + entropy-based detection), and **MIT license** (no copyleft restrictions).

### How It Works

```
Developer writes code
  ↓
git add → git commit
  ↓
Pre-commit hook runs: gitleaks protect --staged
  ↓
Scans staged files for:
  - High-entropy strings (potential API keys)
  - Known secret patterns (AWS keys, JWT secrets, passwords in config)
  - Custom rules from .gitleaks.toml
  ↓
If leak found → commit BLOCKED with details
If clean → commit proceeds
```

### Running Credential Scans

```bash
# Full repository scan (all files)
cd backend && npm run secrets:scan

# Scan only staged files (what pre-commit does)
cd backend && npm run secrets:scan:staged

# Direct gitleaks command
gitleaks detect --source . --config .gitleaks.toml --verbose

# Scan specific path
gitleaks detect --source ./backend/src --verbose
```

### Installing the Pre-Commit Hook

```bash
cd backend && npm run hooks:install
# Copies scripts/pre-commit to .git/hooks/pre-commit
# Makes it executable
```

### Configuration (`.gitleaks.toml`)

The config file at the project root customizes Gitleaks behavior:

```toml
[allowlist]
  # Directories to skip (no secrets expected)
  paths = [
    '''node_modules''',
    '''.env.example''',
    '''coverage''',
    '''dist''',
    '''logs''',
    '''.git''',
    '''package-lock.json''',
  ]
  
  # Test JWT secrets (not real secrets)
  regexes = [
    '''integration-test-secret-key''',
    '''test-secret-key-for-data-crud''',
    # ... other test secrets
  ]
```

**Why allowlists?** Test files use hardcoded JWT secrets like `'integration-test-secret-key'` for mocked auth. These are not real secrets but trigger Gitleaks' entropy detection. Allowlisting them prevents false positives without disabling the scanner.

### What To Do When Gitleaks Blocks a Commit

1. **Read the output** — Gitleaks shows the file, line, and matched pattern
2. **If it's a real secret** — Remove it, use an environment variable instead
3. **If it's a false positive** — Add the specific string to `.gitleaks.toml` `[allowlist].regexes`
4. **Never** disable the pre-commit hook to bypass a finding

### CI Integration

```yaml
# GitHub Actions
- uses: gitleaks/gitleaks-action@v2
  env:
    GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

---

## API Security

### Rate Limiting

| Endpoint | Window | Max Requests | Purpose |
|----------|--------|-------------|---------|
| `POST /api/2026-02-24/auth/login` | 15 min | 10 | Prevents password brute force. 10 attempts covers typos. |
| All `/api/*` | 1 min | 200 | Prevents DoS. 200/min is generous for humans, blocks scripts. |

**Implementation**: `express-rate-limit` middleware in `app.ts`.

### Input Validation

Every `POST` and `PUT` endpoint validates the request body using Zod schemas:

```typescript
// Middleware chain
router.post('/', authenticate, authorize(['admin', 'site_user']), validate(energySchema), handler);
```

**Why Zod?** TypeScript-native validation with type inference. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full rationale.

### Error Handling

The global error handler (`errorHandler.ts`) ensures:
- **Production**: Generic error messages ("Internal server error"), no stack traces
- **Development**: Full error details and stack traces for debugging
- **All environments**: Appropriate HTTP status codes (400, 401, 403, 404, 409, 429, 500)

### CORS

Configured in `app.ts` to allow requests only from the frontend origin. In Docker deployment, Nginx handles this implicitly (same origin).

---

## Database Security

| Practice | Implementation | Why |
|----------|---------------|-----|
| Strong password | 32+ char random via `openssl rand` | Prevents brute force if port 5432 is exposed |
| Named user | Custom `POSTGRES_USER` (not `postgres`) | Avoids default superuser name |
| Network isolation | Docker internal network | DB only accessible from backend container, not host network |
| Parameterized queries | Prisma ORM (all queries parameterized) | Prevents SQL injection — Prisma never interpolates user input into query strings |
| Audit logging | `audit_logs` table | Every INSERT/UPDATE/DELETE recorded with user, table, action, and before/after data |

### SQL Injection Prevention

Prisma inherently prevents SQL injection because all queries use parameterized statements:

```typescript
// This is SAFE — Prisma parameterizes siteId
prisma.energyData.findMany({ where: { siteId: req.query.siteId } });

// The ONE raw query in the codebase also uses parameterized input:
prisma.$queryRaw`SELECT ... WHERE site_id = ${siteId}`;
```

---

## Docker Security

| Practice | Implementation | Why |
|----------|---------------|-----|
| Non-root user | `USER node` in backend Dockerfile | Container processes shouldn't run as root |
| Alpine base images | `node:20-alpine`, `postgres:16-alpine` | Smaller attack surface (fewer packages) |
| Multi-stage builds | Build stage → production stage | Build tools (compilers, dev deps) not in final image |
| No `.env` in image | `.dockerignore` excludes `.env` | Secrets aren't baked into image layers |
| Log rotation | JSON driver, 10 MB, 5 files | Prevents disk exhaustion attacks via log flooding |
| Health checks | `pg_isready` for DB | Automatic restart on failure |

---

## Security Checklist

### Before First Deployment

- [ ] Run `./scripts/setup-env.sh` to generate secrets
- [ ] Verify `.env` is in `.gitignore` (never committed)
- [ ] Install pre-commit hook: `cd backend && npm run hooks:install`
- [ ] Run full secret scan: `cd backend && npm run secrets:scan`
- [ ] Change default admin email from `admin@esg.local` to real address
- [ ] Set `ADMIN_PASSWORD` to a strong password (12+ chars recommended)
- [ ] Verify PostgreSQL port 5432 is not exposed to public network

### Regular Maintenance

- [ ] Update dependencies monthly (`npm audit`, `npm update`)
- [ ] Review audit logs for suspicious activity (`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50`)
- [ ] Rotate JWT_SECRET if a team member leaves (invalidates all active sessions)
- [ ] Rotate DB_PASSWORD periodically (update `.env` + restart containers)
- [ ] Check for Gitleaks updates (`gitleaks version`)
- [ ] Review rate limiting thresholds if user base grows

### Code Review Security Items

- [ ] No hardcoded secrets (Gitleaks should catch these)
- [ ] New endpoints have `authenticate` middleware
- [ ] Destructive endpoints have `authorize(['admin'])`
- [ ] Input validated with Zod schema
- [ ] Audit logging for data mutations
- [ ] Error responses don't leak internal details

---

## Incident Response

### Leaked Secret Detected

1. **Immediately rotate** the compromised secret:
   - `JWT_SECRET`: Change in `.env`, restart containers (invalidates all sessions)
   - `DB_PASSWORD`: Change in `.env` AND in PostgreSQL (`ALTER USER ... PASSWORD '...'`), restart containers
2. **Audit**: Check `audit_logs` for unauthorized access during exposure window
3. **Git history**: If secret was committed, use `git filter-branch` or `BFG Repo-Cleaner` to remove from history
4. **Root cause**: Why did Gitleaks not catch it? Update `.gitleaks.toml` rules if needed

### Suspicious Login Activity

1. Check failed login attempts: `grep "Login failed" logs/combined.log`
2. Check rate limiter hits: `grep "429" logs/combined.log`
3. If an account is compromised: deactivate user via admin API (`PUT /api/admin/users/:id { isActive: false }`)
4. Rotate `JWT_SECRET` to invalidate all sessions
