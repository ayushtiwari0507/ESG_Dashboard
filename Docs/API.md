# API Reference

All endpoints are prefixed with `/api/2026-02-24` (date-based API versioning). Authentication required unless noted.

The health endpoint is the only unversioned route: `GET /api/health`.

> **OpenAPI 3.0 Spec**: Machine-readable API specification is available at [api-specs/openapi.yaml](../api-specs/openapi.yaml).
> Import into tools like [Swagger Editor](https://editor.swagger.io/), Postman, or Insomnia for interactive exploration.
>
> **Validate changes**: Run `npm run validate:api-spec` from the project root to lint the spec.

## Health (Unversioned)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Service health check (returns `apiVersion`) |

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/2026-02-24/auth/login` | No | Login with email/password, returns JWT |
| `GET` | `/api/2026-02-24/auth/me` | Yes | Get current user profile + assigned sites |

## Sites

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/sites` | Yes | All | List all active sites |
| `GET` | `/api/2026-02-24/sites/:id` | Yes | All | Get site details |

## Data Entry — Energy

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/energy` | Yes | All | List energy data (filter: siteId, month, year) |
| `POST` | `/api/2026-02-24/data/energy` | Yes | Admin, Site User | Create energy entry (auto-calculates total GJ) |
| `PUT` | `/api/2026-02-24/data/energy/:id` | Yes | Admin, Site User | Update energy entry |
| `DELETE` | `/api/2026-02-24/data/energy/:id` | Yes | Admin | Delete energy entry |

## Data Entry — Production

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/production` | Yes | All | List production data |
| `POST` | `/api/2026-02-24/data/production` | Yes | Admin, Site User | Create production entry |

## Data Entry — Water

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/water` | Yes | All | List water consumption data |
| `POST` | `/api/2026-02-24/data/water` | Yes | Admin, Site User | Create water entry |
| `PUT` | `/api/2026-02-24/data/water/:id` | Yes | Admin, Site User | Update water entry |
| `DELETE` | `/api/2026-02-24/data/water/:id` | Yes | Admin | Delete water entry |

## Data Entry — Waste

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/waste` | Yes | All | List waste data |
| `POST` | `/api/2026-02-24/data/waste` | Yes | Admin, Site User | Create waste entry |
| `PUT` | `/api/2026-02-24/data/waste/:id` | Yes | Admin, Site User | Update waste entry |
| `DELETE` | `/api/2026-02-24/data/waste/:id` | Yes | Admin | Delete waste entry |

## Data Entry — ETP

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/etp` | Yes | All | List ETP data |
| `POST` | `/api/2026-02-24/data/etp` | Yes | Admin, Site User | Create ETP entry |
| `PUT` | `/api/2026-02-24/data/etp/:id` | Yes | Admin, Site User | Update ETP entry |
| `DELETE` | `/api/2026-02-24/data/etp/:id` | Yes | Admin | Delete ETP entry |

## Data Entry — GHG Emissions

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/ghg` | Yes | All | List GHG emissions data |
| `POST` | `/api/2026-02-24/data/ghg` | Yes | Admin, Site User | Create GHG entry |
| `PUT` | `/api/2026-02-24/data/ghg/:id` | Yes | Admin, Site User | Update GHG entry |
| `DELETE` | `/api/2026-02-24/data/ghg/:id` | Yes | Admin | Delete GHG entry |

## Data Entry — Air Emissions

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/air-emissions` | Yes | All | List air emissions data |
| `POST` | `/api/2026-02-24/data/air-emissions` | Yes | Admin, Site User | Create air emissions entry |
| `PUT` | `/api/2026-02-24/data/air-emissions/:id` | Yes | Admin, Site User | Update air emissions entry |
| `DELETE` | `/api/2026-02-24/data/air-emissions/:id` | Yes | Admin | Delete air emissions entry |

## Data Entry — Sales

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/sales` | Yes | All | List sales data |
| `POST` | `/api/2026-02-24/data/sales` | Yes | Admin, Site User | Create sales entry |
| `PUT` | `/api/2026-02-24/data/sales/:id` | Yes | Admin, Site User | Update sales entry |
| `DELETE` | `/api/2026-02-24/data/sales/:id` | Yes | Admin | Delete sales entry |

## Data Entry — Recovery

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/data/recovery` | Yes | All | List recovery data |
| `POST` | `/api/2026-02-24/data/recovery` | Yes | Admin, Site User | Create recovery entry |
| `PUT` | `/api/2026-02-24/data/recovery/:id` | Yes | Admin, Site User | Update recovery entry |
| `DELETE` | `/api/2026-02-24/data/recovery/:id` | Yes | Admin | Delete recovery entry |

## Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/2026-02-24/dashboard/summary` | Yes | KPI metrics (query: year, siteId) |
| `GET` | `/api/2026-02-24/dashboard/site-comparison` | Yes | Site-by-site comparison (query: year) |
| `GET` | `/api/2026-02-24/dashboard/emissions-trend` | Yes | Monthly energy/emissions trend (query: year, siteId) |

## Users (Admin Only)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/users` | Yes | Admin | List all users |
| `GET` | `/api/2026-02-24/users/:id` | Yes | Admin | Get user details |
| `POST` | `/api/2026-02-24/users` | Yes | Admin | Create user |
| `PUT` | `/api/2026-02-24/users/:id` | Yes | Admin | Update user |
| `DELETE` | `/api/2026-02-24/users/:id` | Yes | Admin | Deactivate user |

## Audit

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/2026-02-24/audit-logs` | Yes | Admin | Immutable audit trail (filter: table, recordId, userId) |

## Telemetry

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/2026-02-24/telemetry/error` | No | Receive frontend error reports |
| `POST` | `/api/2026-02-24/telemetry/vitals` | No | Receive web-vitals performance metrics |

## Manual API Testing

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/2026-02-24/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Use token for authenticated requests
curl -s http://localhost:4000/api/2026-02-24/sites \
  -H "Authorization: Bearer $TOKEN"

curl -s "http://localhost:4000/api/2026-02-24/dashboard/summary?year=2025" \
  -H "Authorization: Bearer $TOKEN"

# Health check (unversioned)
curl -s http://localhost:4000/api/health
```
