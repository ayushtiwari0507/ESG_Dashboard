# Architecture & Technology Decisions

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Technology Stack](#technology-stack)
- [Backend Decisions](#backend-decisions)
- [Frontend Decisions](#frontend-decisions)
- [Database Decisions](#database-decisions)
- [Infrastructure Decisions](#infrastructure-decisions)
- [Security Decisions](#security-decisions)
- [Testing Decisions](#testing-decisions)
- [Data Flow](#data-flow)
- [Module Structure](#module-structure)

---

## System Overview

The ESG & Environmental Data Management Platform is a full-stack web application for collecting, managing, and visualizing environmental compliance data across industrial sites. It handles 9 environmental data categories (energy, production, water, waste, ETP, GHG emissions, air emissions, sales, recovery) with role-based access control, audit logging, and dashboard analytics.

**Architecture style**: Monorepo with separate frontend/backend deployable as Docker containers behind an Nginx reverse proxy.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┐  │
│  │   Frontend    │   │   Backend    │   │ PostgreSQL │  │
│  │   (Nginx)     │──▶│  (Express)   │──▶│   (DB)     │  │
│  │   Port 3000   │   │  Port 4000   │   │  Port 5432 │  │
│  │               │   │              │   │            │  │
│  │  React 18     │   │  Node.js 20  │   │  v16       │  │
│  │  Vite build   │   │  TypeScript  │   │  19 tables │  │
│  │  Tailwind CSS │   │  Prisma ORM  │   │            │  │
│  └──────────────┘   └──────────────┘   └────────────┘  │
│         │                  │                  │          │
│         │   Nginx proxies  │                  │          │
│         │   /api/* ────────┘                  │          │
│         │   /* ──── serves static files        │          │
└─────────────────────────────────────────────────────────┘
```

### Request Flow

```
Browser → Nginx (port 3000)
  ├─ /api/*  → proxy_pass → Express (port 4000)
  │             ├─ Rate Limiter
  │             ├─ Morgan (HTTP logging)
  │             ├─ CORS
  │             ├─ JSON Parser
  │             ├─ authenticate (JWT verify)
  │             ├─ authorize (role check)
  │             ├─ validate (Zod schema)
  │             ├─ Route Handler
  │             │   ├─ Prisma query
  │             │   └─ Audit log
  │             └─ Error Handler
  └─ /*     → serve static React build (index.html, JS, CSS)
```

---

## Technology Stack

| Layer | Technology | Version | License |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 20 LTS | MIT |
| **Language** | TypeScript | 5.7 | Apache-2.0 |
| **Backend Framework** | Express.js | 4.x | MIT |
| **ORM** | Prisma | 6.4 | Apache-2.0 |
| **Validation** | Zod | 3.24 | MIT |
| **Auth** | jsonwebtoken + bcryptjs | 9.x / 2.x | MIT |
| **Logging** | Winston + Morgan | 3.x / 1.x | MIT |
| **Frontend Framework** | React | 18.3 | MIT |
| **Build Tool** | Vite | 6.1 | MIT |
| **CSS** | Tailwind CSS | 3.4 | MIT |
| **Charts** | Apache ECharts | 5.6 | Apache-2.0 |
| **HTTP Client** | Axios | 1.7 | MIT |
| **Router** | React Router | 7.2 | MIT |
| **Database** | PostgreSQL | 16 | PostgreSQL License |
| **Web Server** | Nginx | alpine | BSD-2 |
| **Container** | Docker + Compose | 28.x | Apache-2.0 |
| **Backend Testing** | Jest + ts-jest + supertest | 30/29/7 | MIT |
| **Frontend Testing** | Vitest + Testing Library | 4.x/16.x | MIT |
| **Credential Scanning** | Gitleaks | 8.21 | MIT |

---

## Backend Decisions

### Why Express.js (not Fastify, NestJS, Koa)?

| Criterion | Express | Fastify | NestJS | Koa |
|-----------|---------|---------|--------|-----|
| **Maturity** | 14+ years | 7 years | 7 years | 10 years |
| **Ecosystem** | Largest | Growing | Express-based | Smaller |
| **Learning curve** | Minimal | Low | High (DI, decorators) | Low |
| **Performance** | Good | Best | Express-level | Good |
| **Middleware ecosystem** | Thousands | Compatible | Express middleware | Limited |

**Decision**: Express was chosen for its **unmatched middleware ecosystem** (cors, morgan, express-rate-limit, multer), minimal configuration, and team familiarity. For an ESG data platform where throughput is not the bottleneck (admin users, batch data entry), Express's simplicity outweighs Fastify's raw speed advantage.

**Why not NestJS?** NestJS adds significant complexity (dependency injection, decorators, modules) that isn't justified for a platform with straightforward CRUD routes. Our module-based file structure (`modules/energy/`, `modules/water/`) achieves similar separation without framework overhead.

### Why Prisma ORM (not TypeORM, Knex, Sequelize)?

| Criterion | Prisma | TypeORM | Knex | Sequelize |
|-----------|--------|---------|------|-----------|
| **Type safety** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Schema definition** | Declarative `.prisma` | Decorators/entities | Manual migrations | Model classes |
| **Migration workflow** | `prisma migrate dev` | `typeorm migration:generate` | `knex migrate:make` | `sequelize db:migrate` |
| **Query builder** | Auto-generated client | Query builder | Raw SQL builder | Method chaining |
| **Learning curve** | Low | Medium | Low | Medium |

**Decision**: Prisma provides **end-to-end type safety** — the generated client types are derived directly from `schema.prisma`, so TypeScript catches query errors at compile time. The declarative schema is the single source of truth for database structure, migrations, and TypeScript types.

**Key advantages for this project:**
- `prisma generate` auto-creates typed client for 19 models
- `prisma migrate dev` handles schema evolution without manual SQL
- `prisma.user.findUnique({ where: { email } })` — full autocomplete and type checking
- Prisma Studio for visual database inspection during development

### Why Zod (not Joi, Yup, class-validator)?

| Criterion | Zod | Joi | Yup | class-validator |
|-----------|-----|-----|-----|-----------------|
| **TypeScript-first** | Yes (infers types) | No (separate types) | Partial | Decorators |
| **Bundle size** | 12 KB | 30 KB | 20 KB | Requires reflect-metadata |
| **Type inference** | `z.infer<typeof schema>` | Manual typing | Manual typing | Manual typing |
| **Composability** | Excellent | Good | Good | Limited |

**Decision**: Zod is **TypeScript-native** — define a schema once, and `z.infer<>` gives you the TypeScript type for free. No duplicate type definitions. Combined with our `validate` middleware, request bodies are validated and typed in a single step.

```typescript
// Define schema once
const energySchema = z.object({ siteId: z.number(), fuelType: z.string() });
// TypeScript type is inferred automatically
type EnergyInput = z.infer<typeof energySchema>;
```

### Why Winston (not Pino, Bunyan, console)?

| Criterion | Winston | Pino | Bunyan | console |
|-----------|---------|------|--------|---------|
| **Transports** | Many (file, console, HTTP, DB) | Few (file, pretty) | File, stream | stdout only |
| **Log levels** | Configurable | Fixed | Fixed | log/warn/error |
| **Structured logging** | JSON or text | JSON only | JSON only | Unstructured |
| **File rotation** | Built-in (DailyRotateFile) | External | External | None |

**Decision**: Winston's **multi-transport architecture** supports our logging requirements: colorized console in development, JSON files in production, separate error log file, and rotation. Morgan HTTP logging pipes through Winston for unified log management.

### Why jsonwebtoken + bcryptjs (not Passport.js, Auth0)?

**Decision**: Lightweight, self-contained auth without external dependencies or third-party services. The ESG platform is deployed on-premise — external auth providers may not be available. JWT + bcrypt provides:
- Stateless authentication (no session store needed)
- Role-based access control (admin, site_user, viewer encoded in JWT)
- Simple middleware chain: `authenticate` → `authorize(['admin'])`

---

## Frontend Decisions

### Why React 18 (not Vue, Angular, Svelte)?

**Decision**: React's **component model and ecosystem** are the best fit for a data-heavy dashboard application:
- Largest ecosystem for charting (ECharts, Recharts, Victory)
- Testing Library has best React support
- Team familiarity and hiring pool
- Concurrent features (Suspense, transitions) for responsive UIs with heavy data

### Why Vite (not Create React App, Webpack, Parcel)?

| Criterion | Vite | CRA (Webpack) | Raw Webpack | Parcel |
|-----------|------|--------------|-------------|--------|
| **Dev server start** | < 300ms | 10-30s | Configurable | 1-3s |
| **HMR speed** | Instant (ESM) | 1-5s | 1-5s | 1-3s |
| **Config complexity** | Minimal | Hidden | Complex | Zero |
| **Build tool** | Rollup (production) | Webpack | Webpack | SWC |

**Decision**: Vite's **instant dev server** (native ESM, no bundling in dev) dramatically improves the development experience. CRA is deprecated. Raw Webpack requires extensive configuration. Vite provides sensible defaults with escape hatches via `vite.config.ts`.

### Why Tailwind CSS (not Bootstrap, Material UI, CSS Modules)?

**Decision**: Tailwind's **utility-first approach** eliminates the CSS maintenance burden:
- No separate CSS files to maintain — styles are co-located with markup
- Consistent design system via `tailwind.config.js` (colors, spacing, breakpoints)
- Tree-shaking removes unused utilities — production CSS is typically < 10 KB
- No component library lock-in — full design control

### Why Apache ECharts (not Chart.js, Recharts, D3)?

| Criterion | ECharts | Chart.js | Recharts | D3 |
|-----------|---------|----------|----------|-----|
| **Chart types** | 30+ | 8 basic | 15+ | Unlimited |
| **Large datasets** | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| **Interactivity** | Built-in (tooltip, zoom, brush) | Basic | Basic | Manual |
| **React integration** | echarts-for-react | react-chartjs-2 | Native React | Manual |

**Decision**: ECharts handles **large environmental datasets** (thousands of monthly records across sites) with built-in performance optimizations. Its rich interactivity (tooltips, data zoom, brush selection) is essential for ESG dashboards where users need to explore trends across time periods and sites.

### Why Axios (not fetch)?

**Decision**: Axios provides **interceptors** for attaching JWT tokens and handling 401 responses globally:
```typescript
api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```
Native `fetch` requires manual wrapper functions for the same behavior.

---

## Database Decisions

### Why PostgreSQL (not MySQL, MongoDB, SQLite)?

| Criterion | PostgreSQL | MySQL | MongoDB | SQLite |
|-----------|-----------|-------|---------|--------|
| **ACID compliance** | Full | Full (InnoDB) | Partial | Full |
| **JSON support** | Native (jsonb) | JSON type | Native | JSON1 extension |
| **Advanced queries** | CTEs, window functions | 8.0+ only | Aggregation pipeline | Limited |
| **Prisma support** | Excellent | Good | Good | Good (dev only) |
| **Concurrent writes** | MVCC (excellent) | Lock-based | Lock-free | File-level lock |

**Decision**: PostgreSQL's **advanced query capabilities** (window functions, CTEs, JSONB) are needed for dashboard aggregations (emissions trends, site comparisons, energy totals). Its MVCC concurrency model handles simultaneous data entry from multiple site users without lock contention.

### Schema Design Principles

1. **One table per environmental category** — `energy_data`, `water_data`, `waste_data`, etc. Separate tables (not a generic `data` table) because each category has unique columns (e.g., energy has `fuel_type` + `total_energy_gj`, water has `source` + `recycled_pct`).

2. **Soft-delete not used** — Hard delete with audit log. The `audit_logs` table captures every INSERT/UPDATE/DELETE with before/after snapshots, providing full traceability without the complexity of soft-delete filters on every query.

3. **Site as the organizing entity** — All data records reference `site_id`. Users are assigned to sites. Dashboards aggregate by site. This models real-world ESG reporting where data is collected per manufacturing facility.

4. **Unique constraints per reporting period** — Composite unique indexes on `(site_id, month, year, ...)` prevent duplicate entries for the same reporting period.

---

## Infrastructure Decisions

### Why Docker Compose (not Kubernetes, bare metal)?

**Decision**: Docker Compose provides **single-command deployment** (`docker compose up -d`) that's appropriate for a single-server ESG platform:
- 3 services defined declaratively
- Shared network with DNS resolution (services reference each other by name)
- Volume persistence for PostgreSQL data
- Log rotation configured per service
- No orchestration overhead (no etcd, no control plane)

**When to migrate to Kubernetes**: When the platform needs horizontal scaling (multiple backend replicas), high availability, or multi-cluster deployment.

### Why Nginx Reverse Proxy (not serve, Express static)?

**Decision**: Nginx provides **production-grade static serving and reverse proxying** in a single layer:
- Serves the React build as static files (gzip, cache headers)
- Proxies `/api/*` to the Express backend
- Handles SPA routing (returns `index.html` for all non-file routes via `try_files`)
- Connection pooling and buffering for backend requests
- Lower memory footprint than Node.js for static file serving

---

## Security Decisions

### Authentication & Authorization

| Feature | Implementation | Rationale |
|---------|---------------|-----------|
| Password hashing | bcryptjs (10 rounds) | Industry standard, timing-safe comparison |
| Token format | JWT (HS256) | Stateless, encodes role for RBAC without DB lookup |
| Token lifetime | 24h access, 7d refresh | Balance between security and UX |
| Role model | 3 roles: admin, site_user, viewer | Matches organizational hierarchy |
| Rate limiting | 10 login/15min, 200 API/min | Prevents brute force and abuse |

### Credential Scanning

| Tool | Purpose | Integration |
|------|---------|-------------|
| Gitleaks 8.21 | Detect secrets in code | Pre-commit hook + npm script |
| `.gitleaks.toml` | Custom rules/allowlists | Allowlists test JWT secrets |
| `scripts/pre-commit` | Block commits with secrets | Installed via `npm run hooks:install` |

See [SECURITY.md](SECURITY.md) for full security practices.

### API Specification

All endpoints documented in OpenAPI 3.0.3 format at [api-specs/openapi.yaml](../api-specs/openapi.yaml). See [API.md](API.md) for the quick reference table.

**API Versioning**: All routes use date-based versioning: `/api/2026-02-24/...`. The health endpoint (`/api/health`) remains unversioned. Validate spec changes with `npm run validate:api-spec`.

---

## Testing Decisions

See [TESTING.md](TESTING.md) for the complete testing guide including:
- Why Jest for backend / Why Vitest for frontend
- Mock patterns and conventions
- Coverage thresholds (90% enforced)
- How to debug failing tests
- How to add new tests

---

## Data Flow

### Data Entry Flow

```
User fills form → React state → Axios POST /api/data/energy
  → Rate Limiter (200/min)
  → authenticate (verify JWT)
  → authorize (['admin', 'site_user'])
  → validate (Zod schema)
  → Route Handler
    → Prisma create (with calculated fields like totalEnergyGJ)
    → Audit log INSERT
  → 201 { id, ...record }
  → React updates table
```

### Dashboard Flow

```
User opens Dashboard → Axios GET /api/dashboard/summary
  → authenticate
  → Route Handler
    → Prisma aggregation queries ($queryRaw for complex aggregations)
    → Transform results
  → 200 { totalEnergy, totalWater, totalEmissions, ... }
  → ECharts renders visualizations
```

---

## Module Structure

### Backend Module Pattern

Each data module follows an identical structure:

```
modules/
  energy/
    energy.routes.ts     # Express router with GET/POST/PUT/DELETE
    energy.schema.ts     # Zod validation schemas
    energy.service.ts    # Business logic (optional, only for complex modules)
```

**Route pattern (all 9 data modules):**

| Method | Route | Auth | Middleware | Handler |
|--------|-------|------|-----------|---------|
| GET | `/api/data/{module}` | Any role | authenticate | List with optional filters (siteId, month, year) |
| POST | `/api/data/{module}` | admin, site_user | authenticate, authorize, validate | Create + audit log |
| PUT | `/api/data/{module}/:id` | admin, site_user | authenticate, authorize | Update + merge fields + audit log |
| DELETE | `/api/data/{module}/:id` | admin only | authenticate, authorize | Delete + audit log |

**Exceptions:**
- `production` — GET + POST only (no edit/delete)
- `water` — GET + POST + PUT (no delete)
- `energy` — Delegates to `energyService` which calculates `totalEnergyGJ` from fuel type conversion factors

### Frontend Page Pattern

```
pages/
  LoginPage.tsx        # Auth form
  DashboardPage.tsx    # ECharts visualizations
  DataEntryPage.tsx    # 9-tab form with table view per module
  AuditLogPage.tsx     # Searchable audit trail
  UserManagementPage   # Admin user CRUD
```

Each data entry tab follows the pattern: form → submit → table with edit/delete actions.
