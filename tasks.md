# ESG Web Application — Task Tracker

**Last Updated:** 2026-02-24

---

## Phase 1 — Core Setup (Complete)

| # | Task | Status |
|---|------|--------|
| 1 | Project setup (package.json, tsconfig, Prisma) | ✅ Done |
| 2 | Prisma schema + migrations + seed | ✅ Done |
| 3 | Auth module (login, JWT, RBAC) | ✅ Done |
| 4 | Sites module | ✅ Done |
| 5 | Energy data entry module | ✅ Done |
| 6 | Production data entry module | ✅ Done |
| 7 | Dashboard summary endpoint | ✅ Done |
| 8 | Audit logger | ✅ Done |
| 9 | Logging (Winston + Morgan) | ✅ Done |
| 10 | Vite + React + TS + Tailwind scaffold | ✅ Done |
| 11 | Login page | ✅ Done |
| 12 | Layout (sidebar, topbar) | ✅ Done |
| 13 | Dashboard page with charts | ✅ Done |
| 14 | Data entry form (energy) | ✅ Done |
| 15 | API client layer | ✅ Done |
| 16 | Docker Compose + Dockerfiles | ✅ Done |
| 17 | Full deployment verification | ✅ Done |

## Phase 2 — Security & Documentation (Complete)

| # | Task | Status |
|---|------|--------|
| 18 | Remove hardcoded credentials from code | ✅ Done |
| 19 | Create setup-env.sh script | ✅ Done |
| 20 | Create .gitignore | ✅ Done |
| 21 | Create .env.example with placeholders | ✅ Done |
| 22 | Clean seed.ts (env-based admin creds) | ✅ Done |
| 23 | Clean LoginPage (no pre-filled creds) | ✅ Done |
| 24 | Create comprehensive README.md | ✅ Done |

## Phase 3 — Design Gap Implementation (Complete)

### Backend — Data Entry Modules

| # | Task | Status |
|---|------|--------|
| 25 | Water data entry (CRUD + validation + audit) | ✅ Done |
| 26 | Waste data entry (CRUD + validation + audit) | ✅ Done |
| 27 | ETP data entry (CRUD + validation + audit) | ✅ Done |
| 28 | GHG emissions (CRUD + scope 1/2/3 + audit) | ✅ Done |
| 29 | Air emissions (CRUD + SOx/NOx/PM/VOC + audit) | ✅ Done |
| 30 | Sales data entry (CRUD + audit) | ✅ Done |
| 31 | Recovery data entry (CRUD + audit) | ✅ Done |

### Backend — Admin & Reference Data

| # | Task | Status |
|---|------|--------|
| 32 | User management module (CRUD + role/site assign) | ✅ Done |
| 33 | Prisma schema: SalesData, AirEmissionsData, RecoveryData | ✅ Done |
| 34 | Prisma schema: Scope3Category enum | ✅ Done |
| 35 | Route registration in app.ts (all 12 routes) | ✅ Done |

### Frontend

| # | Task | Status |
|---|------|--------|
| 36 | Tabbed data entry page (9 modules) | ✅ Done |
| 37 | User management page (admin) | ✅ Done |
| 38 | Nav + routing for Users page | ✅ Done |

### Verification

| # | Task | Status |
|---|------|--------|
| 39 | Docker rebuild with new code | ✅ Done |
| 40 | All new API endpoints tested (water, waste, ETP, sales, air, recovery, users) | ✅ Done |
| 41 | Frontend HTTP 200 verified | ✅ Done |

## Phase 4 — Remaining Gap Items (Future)

| # | Task | Status |
|---|------|--------|
| 42 | Reference data CRUD (units, emission factors, GWP) | 🔲 Planned |
| 43 | Targets module (set/track KPI targets) | 🔲 Planned |
| 44 | Data approval workflow (draft → submitted → approved) | 🔲 Planned |
| 45 | Dashboard: water/waste/ETP charts | 🔲 Planned |
| 46 | Dashboard: year-over-year comparison | 🔲 Planned |
| 47 | CSV/Excel export | 🔲 Planned |
| 48 | Password reset / change password | 🔲 Planned |
| 49 | Site CRUD (admin create/edit sites) | 🔲 Planned |
| 50 | GHG auto-calculation (activity × EF) | 🔲 Planned |
| 51 | Intensity KPI auto-calc (per MT production) | 🔲 Planned |

## Phase 5 — Testing, Logging & Docs (Complete)

### Testing Infrastructure

| # | Task | Status |
|---|------|--------|
| 52 | Backend: Jest + ts-jest + supertest installed | ✅ Done |
| 53 | Backend: jest.config.js with coverage thresholds | ✅ Done |
| 54 | Backend: Unit tests — validate middleware (4 tests) | ✅ Done |
| 55 | Backend: Unit tests — authenticate middleware (5 tests) | ✅ Done |
| 56 | Backend: Unit tests — authorize middleware (8 tests) | ✅ Done |
| 57 | Backend: Unit tests — errorHandler middleware (3 tests) | ✅ Done |
| 58 | Backend: Unit tests — auth schema (7 tests) | ✅ Done |
| 59 | Backend: Unit tests — auth service (8 tests) | ✅ Done |
| 60 | Backend: Unit tests — energy schema (7 tests) | ✅ Done |
| 61 | Backend: Integration tests — all routes via supertest (17 tests) | ✅ Done |
| 62 | Frontend: Vitest + @testing-library/react + jsdom installed | ✅ Done |
| 63 | Frontend: vitest config in vite.config.ts + setup file | ✅ Done |
| 64 | Frontend: LoginPage tests (7 tests) | ✅ Done |
| 65 | Frontend: AuthContext tests (6 tests) | ✅ Done |
| 66 | Frontend: App router tests (2 tests) | ✅ Done |
| 67 | Frontend: API client tests (1 test) | ✅ Done |
| 68 | All 75 tests passing (59 backend + 16 frontend) | ✅ Done |

### Logging & Telemetry (Design Compliance)

| # | Task | Status |
|---|------|--------|
| 69 | Winston: Add file transports (error.log + combined.log, 10MB rotation) | ✅ Done |
| 70 | Winston: Console JSON format in production | ✅ Done |
| 71 | Telemetry routes: POST /api/telemetry/error | ✅ Done |
| 72 | Telemetry routes: POST /api/telemetry/vitals | ✅ Done |
| 73 | Frontend: ErrorBoundary component with telemetry reporting | ✅ Done |
| 74 | Docker: Log rotation config on all 3 services | ✅ Done |

### Documentation

| # | Task | Status |
|---|------|--------|
| 75 | TSGs folder: backend-debugging.md | ✅ Done |
| 76 | TSGs folder: frontend-debugging.md | ✅ Done |
| 77 | TSGs folder: database-debugging.md | ✅ Done |
| 78 | TSGs folder: docker-debugging.md | ✅ Done |
| 79 | TSGs folder: logging-monitoring.md | ✅ Done |
| 80 | Docs/API.md (full API reference, all routes) | ✅ Done |
| 81 | Docs/USER_GUIDE.md | ✅ Done |
| 82 | Docs/CONFIGURATION.md | ✅ Done |
| 83 | Docs/TESTING.md | ✅ Done |
| 84 | README.md slimmed (483 → 278 lines, links to split docs) | ✅ Done |

---

## Summary

- **Total tasks:** 84
- **Completed:** 74
- **Remaining:** 10 (Phase 4 — enhancement items)

---

## Bugs Fixed During Deployment

| Issue | File | Fix |
|-------|------|-----|
| Wrong import path `../auth/AuthContext` | `frontend/src/components/layout/MainLayout.tsx` | Changed to `../../auth/AuthContext` |
| `tsc -b` fails without composite tsconfig | `frontend/package.json` | Changed build to `tsc --noEmit && vite build` |
| `prisma migrate deploy` with no migrations | `backend/Dockerfile` | Changed CMD to use `prisma db push --skip-generate` |
| Docker credential helper pointing to Windows exe | `~/.docker/config.json` | Reset to `{}` |
| docker-buildx not found at `/usr/local/lib/docker/cli-plugins/` | System | Symlinked from `/usr/libexec/docker/cli-plugins/` |
| JWT verify type cast error (`JwtPayload` vs `JWTPayload`) | `backend/src/middleware/authenticate.ts` | Cast via `unknown` first |
| JWT sign `expiresIn` type mismatch with `@types/jsonwebtoken` | `backend/src/modules/auth/auth.service.ts` | Cast options `as jwt.SignOptions` |
| Express 5 `req.params` type `string \| string[]` | `backend/src/modules/data-entry/energy/energy.routes.ts`, `sites.routes.ts` | Added `as string` casts |

---

## Verified Endpoints

| Method | URL | Status |
|--------|-----|--------|
| GET | `/api/health` | ✅ 200 |
| POST | `/api/auth/login` | ✅ 200 (returns JWT) |
| GET | `/api/auth/me` | ✅ 200 (user profile) |
| GET | `/api/sites` | ✅ 200 (6 sites) |
| GET | `/api/data/energy?siteId=5&year=2025` | ✅ 200 (seeded data) |
| POST | `/api/data/energy` | ✅ 201 (creates entry with auto total GJ) |
| GET | `/api/data/production?siteId=5&year=2025` | ✅ 200 (seeded data) |
| POST | `/api/data/production` | ✅ 201 (creates entry) |
| GET | `/api/dashboard/summary?year=2025` | ✅ 200 (KPI metrics) |
| GET | `/api/dashboard/site-comparison?year=2025` | ✅ 200 (6 sites compared) |
| GET | `/api/dashboard/emissions-trend?year=2025` | ✅ 200 (monthly trend) |
| GET | `/api/audit-logs` | ✅ 200 (immutable log entries) |

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@esg.local | admin123 |
| Site User | ehs.taloja@esg.local | user123 |

## Running the Application

```bash
cd /home/dmamodiya/test/ESGWebApp
docker compose up -d          # Start all services
docker compose down           # Stop all services
docker compose down -v        # Stop and remove volumes (wipes DB)
docker compose logs backend   # View backend logs
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **PostgreSQL:** localhost:5432
