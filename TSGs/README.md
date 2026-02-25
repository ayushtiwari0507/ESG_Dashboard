# Troubleshooting Guides (TSGs)

Step-by-step guides for debugging common issues in the ESG Platform. Each guide includes technology context (what tools are used and why), diagnostic checklists, command-by-command debugging steps, and common issues tables.

## Index

| Guide | Description | Key Technologies |
|---|---|---|
| [Backend Debugging](backend-debugging.md) | Express API, Prisma, Auth, middleware issues | Express 4, Prisma 6, Zod 3, JWT |
| [Frontend Debugging](frontend-debugging.md) | React, Vite, state management, API calls | React 18, Vite 6, Tailwind, ECharts |
| [Database Debugging](database-debugging.md) | PostgreSQL, Prisma migrations, data issues | PostgreSQL 16, Prisma ORM |
| [Docker Debugging](docker-debugging.md) | Container lifecycle, networking, volumes | Docker Compose, Nginx, alpine images |
| [Logging & Monitoring](logging-monitoring.md) | Winston logs, telemetry, audit trail | Winston, Morgan, AuditLogger |
| [Testing & Test Debugging](testing-debugging.md) | Test failures, mock issues, coverage debugging | Jest 30, Vitest 4, supertest 7 |

## Cleanup

A cleanup script is provided at `scripts/cleanup.sh` for removing Docker instances, build artifacts, logs, and test/coverage outputs:

```bash
# Interactive mode
./scripts/cleanup.sh

# Docker only (containers, images, build cache)
./scripts/cleanup.sh --docker

# Build artifacts (dist/, node_modules/)
./scripts/cleanup.sh --build

# Log files
./scripts/cleanup.sh --logs

# Test/coverage artifacts
./scripts/cleanup.sh --test

# Full cleanup (DESTRUCTIVE — includes Docker volumes)
./scripts/cleanup.sh --all
```

See also `npm run cleanup` / `npm run cleanup:all` from the project root.

## Related Documentation

| Document | Description |
|---|---|
| [TESTING.md](../Docs/TESTING.md) | Complete testing guide — frameworks, rationale, running tests, coverage, writing new tests |
| [CONFIGURATION.md](../Docs/CONFIGURATION.md) | All environment variables, config files, and their rationale |
| [ARCHITECTURE.md](../Docs/ARCHITECTURE.md) | Technology stack decisions, system architecture, data flow |
| [SECURITY.md](../Docs/SECURITY.md) | Authentication, credential scanning (Gitleaks), security practices |
| [API.md](../Docs/API.md) | API endpoint reference |
| [openapi.yaml](../api-specs/openapi.yaml) | OpenAPI 3.0.3 specification (in `api-specs/` folder) |

## How to Use

1. Identify the **layer** where the issue manifests (frontend → backend → database)
2. Open the corresponding guide
3. Read the **Technology Context** section to understand what tools are involved
4. Follow the **diagnostic checklist** in order
5. Check the **Common Issues** table for quick fixes
6. If the issue is test-related, use the [Testing & Test Debugging](testing-debugging.md) guide
7. For cleanup after debugging, use `./scripts/cleanup.sh` (see [Cleanup](#cleanup) section above)

## API Versioning

All API endpoints are versioned with a date-based prefix: `/api/2026-02-24/`. The health endpoint (`/api/health`) remains unversioned.

Examples:
- `GET /api/health` — unversioned, always available
- `POST /api/2026-02-24/auth/login` — versioned
- `GET /api/2026-02-24/data/energy` — versioned

## API Spec Validation

The OpenAPI spec lives at `api-specs/openapi.yaml`. To validate after changes:

```bash
# From project root
npm run validate:api-spec
```

This uses [Redocly CLI](https://redocly.com/docs/cli/) to lint the spec against OpenAPI 3.0 rules defined in `redocly.yaml`.
