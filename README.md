# ESG & Environmental Data Management Platform

A multi-site sustainability data platform for EHS teams to capture monthly environmental data and generate real-time dashboards aligned to **EcoVadis**, **CDP**, **GRI**, **BRSR**, and **GHG Protocol** (Scopes 1, 2, 3).

Designed for **intranet deployment** — runs locally via Docker on any Ubuntu or WSL system with a single command.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Documentation Index](#documentation-index)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Corporate LAN / Wi-Fi              │
│                                                 │
│   Browser ──► http://<HOST-IP>:3000             │
│                      │                          │
│   ┌──────────────────▼──────────────────────┐   │
│   │         Docker Compose Stack            │   │
│   │  ┌──────────┐   ┌──────────┐            │   │
│   │  │ Frontend │──►│ Backend  │            │   │
│   │  │ Nginx    │   │ Node.js  │            │   │
│   │  │ :3000    │   │ :4000    │            │   │
│   │  └──────────┘   └────┬─────┘            │   │
│   │                      │                  │   │
│   │               ┌──────▼──────┐           │   │
│   │               │ PostgreSQL  │           │   │
│   │               │ :5432       │           │   │
│   │               └─────────────┘           │   │
│   └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

- **Frontend** — React SPA served by Nginx, proxies `/api/` to backend
- **Backend** — Express.js REST API with JWT auth and Prisma ORM
- **Database** — PostgreSQL 16 with normalized schema

See [Docs/Design Docs/HLD.md](Docs/Design%20Docs/HLD.md) and [Docs/Design Docs/LLD.md](Docs/Design%20Docs/LLD.md) for detailed design documentation.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Apache ECharts |
| Backend | Node.js 20, Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken) |
| Validation | Zod |
| Logging | Winston + Morgan |
| Containerization | Docker + Docker Compose |
| Web Server | Nginx (reverse proxy + SPA) |

---

## Quick Start

### Prerequisites

- **Docker** (v20+) and **Docker Compose** (v2+)
- **openssl** (for generating secrets)
- Ubuntu 20.04+ or WSL2

Verify prerequisites:
```bash
docker --version
docker compose version
openssl version
```

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ESGWebApp
```

### 2. Generate Environment Configuration

Run the interactive setup script to create your `.env` file with secure random secrets:

```bash
./scripts/setup-env.sh
```

This will prompt you for:
- **Admin email** — the first admin account's email
- **Admin name** — display name for the admin
- **Admin password** — must be at least 8 characters

The script auto-generates:
- A random database password (32 chars)
- A random JWT secret (64 chars)

> **Security note:** The `.env` file contains secrets and is excluded from version control via `.gitignore`. Never commit it.

**Manual setup** (if you prefer not to use the script):
```bash
cp .env.example .env
# Edit .env and fill in DB_PASSWORD, JWT_SECRET, and ADMIN_PASSWORD
```

### 3. Build and Start

```bash
docker compose up --build -d
```

This pulls PostgreSQL, builds the backend and frontend images, runs database migrations, seeds initial data (sites, units, emission factors), and starts all services.

### 4. Access the Application

| Service | URL |
|---------|-----|
| **Web UI** | http://localhost:3000 |
| **API** | http://localhost:4000/api/health |
| **Versioned API** | http://localhost:4000/api/2026-02-24/ |

Log in with the admin credentials you set during setup.

### 5. Stop / Restart

```bash
docker compose down          # Stop all services
docker compose up -d         # Restart
docker compose down -v       # Stop + delete database volume (full reset)
./scripts/cleanup.sh         # Interactive cleanup wizard
./scripts/cleanup.sh --all   # Full cleanup (Docker + build + logs + tests)
```

---

## Development Setup

### Backend Development

```bash
cd backend
npm install

# Create a local .env in the backend directory
cat > .env <<EOF
DATABASE_URL=postgresql://esg_admin:YOUR_PASSWORD@localhost:5432/esg_platform
JWT_SECRET=dev-secret-at-least-32-chars-long-for-local
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
PORT=4000
NODE_ENV=development
LOG_LEVEL=debug
ADMIN_EMAIL=admin@esg.local
ADMIN_PASSWORD=changeme123
ADMIN_NAME=Dev Admin
EOF

# Start PostgreSQL (use Docker)
docker run -d --name esg-db \
  -e POSTGRES_DB=esg_platform \
  -e POSTGRES_USER=esg_admin \
  -e POSTGRES_PASSWORD=YOUR_PASSWORD \
  -p 5432:5432 \
  postgres:16-alpine

# Push schema to database
npx prisma db push

# Seed database
npx prisma db seed

# Start dev server (hot reload)
npm run dev
```

The backend runs at http://localhost:4000.

### Frontend Development

```bash
cd frontend
npm install

# Start dev server (auto-proxies /api to backend:4000)
npm run dev
```

The frontend runs at http://localhost:3000 with hot module replacement. API calls are proxied to `http://localhost:4000` via Vite's dev server config.

### Building for Production

```bash
# Backend
cd backend && npm run build    # Outputs to dist/

# Frontend
cd frontend && npm run build   # Outputs to dist/
```

---

## Project Structure

```
ESGWebApp/
├── docker-compose.yml          # Multi-container orchestration
├── package.json                # Root workspace (cleanup & API spec validation scripts)
├── redocly.yaml                # API spec linting rules
├── .env.example                # Environment template (safe to commit)
├── .gitignore                  # Excludes .env, node_modules, dist
├── api-specs/
│   └── openapi.yaml            # OpenAPI 3.0.3 specification (API version: 2026-02-24)
├── scripts/
│   ├── setup-env.sh            # Interactive env setup with secret generation
│   └── cleanup.sh              # Docker, build, log, and test artifact cleanup
├── backend/
│   ├── Dockerfile              # Multi-stage Node.js build
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (16 models)
│   │   └── seed.ts             # Seeds sites, units, GWP, emission factors
│   └── src/
│       ├── app.ts              # Express app setup, middleware, routes
│       ├── index.ts            # Server entry point
│       ├── config/             # Database, env, logger configuration
│       ├── middleware/         # Auth, RBAC, validation, audit, errors
│       └── modules/            # Feature modules (auth, sites, dashboard, etc.)
├── frontend/
│   ├── Dockerfile              # Multi-stage React build + Nginx
│   ├── nginx.conf              # Reverse proxy + SPA routing
│   ├── package.json
│   └── src/
│       ├── App.tsx             # Router + protected routes
│       ├── api/client.ts       # Axios client with JWT interceptors
│       ├── auth/               # Auth context + hooks
│       ├── components/layout/  # Sidebar, topbar layout
│       └── pages/              # Login, Dashboard, DataEntry, AuditLog
└── Docs/
    ├── Problem Statement       # Original requirements
    └── Design Docs/
        ├── HLD.md              # High-Level Design
        └── LLD.md              # Low-Level Design
```

---

## Documentation Index

Detailed documentation is split into focused guides:

| Document | Description |
|----------|-------------|
| [Architecture & Tech Decisions](Docs/ARCHITECTURE.md) | Technology stack rationale, system design, data flow |
| [API Reference](Docs/API.md) | All REST endpoints with methods, auth, roles |
| [OpenAPI Specification](api-specs/openapi.yaml) | OpenAPI 3.0.3 machine-readable API spec (version: 2026-02-24) |
| [User Guide](Docs/USER_GUIDE.md) | How to use the platform (login, data entry, dashboards) |
| [Configuration](Docs/CONFIGURATION.md) | Environment variables, config files, and rationale |
| [Testing Guide](Docs/TESTING.md) | Framework choices, running tests, coverage, debugging, mock patterns |
| [Security Guide](Docs/SECURITY.md) | Auth, credential scanning (Gitleaks), security practices |
| [Design — HLD](Docs/Design%20Docs/HLD.md) | High-Level Design |
| [Design — LLD](Docs/Design%20Docs/LLD.md) | Low-Level Design |

### Troubleshooting Guides (TSGs)

Step-by-step debugging guides for each layer (each includes technology context, diagnostic checklists, and common issues tables):

| Guide | Description |
|-------|-------------|
| [TSGs/README.md](TSGs/README.md) | Index of all troubleshooting guides |
| [Backend Debugging](TSGs/backend-debugging.md) | Express API, Prisma, Auth, middleware issues |
| [Frontend Debugging](TSGs/frontend-debugging.md) | React, Vite, state management, API calls |
| [Database Debugging](TSGs/database-debugging.md) | PostgreSQL, Prisma migrations, data issues |
| [Docker Debugging](TSGs/docker-debugging.md) | Container lifecycle, networking, volumes |
| [Logging & Monitoring](TSGs/logging-monitoring.md) | Winston logs, telemetry, audit trail |
| [Testing & Test Debugging](TSGs/testing-debugging.md) | Test failures, mock issues, coverage debugging |

---

## License

Internal use only. Not for public distribution.
