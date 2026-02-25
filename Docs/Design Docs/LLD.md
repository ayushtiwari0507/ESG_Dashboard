# ESG & Environmental Data Management Platform — Low-Level Design (LLD)

**Version:** 1.1  
**Date:** 2026-02-24  
**Status:** Draft (Rev 1 — addressed review feedback)  
**Prerequisite:** Read [HLD.md](file:///home/dmamodiya/test/ESGWebApp/Docs/Design%20Docs/HLD.md) first.

---

## Table of Contents

1. [Database Schema (SQL)](#1-database-schema-sql)
2. [API Endpoint Contracts](#2-api-endpoint-contracts)
3. [Authentication & Authorisation Flow](#3-authentication--authorisation-flow)
4. [GHG Emission Calculation Logic](#4-ghg-emission-calculation-logic)
5. [Frontend Component Hierarchy](#5-frontend-component-hierarchy)
6. [Backend Module Details](#6-backend-module-details)
7. [Docker Configuration](#7-docker-configuration)
8. [Data Import / Export Pipelines](#8-data-import--export-pipelines)
9. [Audit Trail Implementation](#9-audit-trail-implementation)
10. [Telemetry & Logging (Backend)](#10-telemetry--logging-backend)
11. [Testing Infrastructure](#11-testing-infrastructure)

---

## 1. Database Schema (SQL)

> **ORM Note:** Prisma is used at runtime, but the canonical schema is represented as raw SQL below for clarity. The Prisma schema will mirror this exactly.

### 1.1 Enums

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'site_user', 'viewer');
CREATE TYPE ghg_scope AS ENUM ('scope_1', 'scope_2', 'scope_3');
CREATE TYPE scope1_category AS ENUM ('stationary', 'mobile', 'process', 'fugitive');
CREATE TYPE scope2_method AS ENUM ('location_based', 'market_based');
CREATE TYPE scope3_category AS ENUM (
    'cat1_purchased_goods',
    'cat2_capital_goods',
    'cat3_fuel_energy',
    'cat4_upstream_transport',
    'cat5_waste_operations',
    'cat6_business_travel',
    'cat7_employee_commuting',
    'cat8_upstream_leased',
    'cat9_downstream_transport',
    'cat10_processing',
    'cat11_use_of_products',
    'cat12_end_of_life',
    'cat13_downstream_leased',
    'cat14_franchises',
    'cat15_investments'
);
CREATE TYPE waste_type AS ENUM ('hazardous', 'non_hazardous');
CREATE TYPE waste_disposal AS ENUM ('recycled', 'co_processed', 'landfilled', 'incinerated', 'other');
CREATE TYPE data_status AS ENUM ('draft', 'submitted', 'approved');
```

### 1.2 Core Tables

```sql
-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE sites (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    code            VARCHAR(10) NOT NULL UNIQUE,   -- e.g. 'TAL', 'DAM'
    location        VARCHAR(255),
    country         VARCHAR(100) NOT NULL DEFAULT 'India',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: Taloja, Daman, Baddi, Tiljala, Sion, Indonesia

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many: which sites a user can access
CREATE TABLE user_sites (
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id     INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
);
```

### 1.3 Reference / Master Tables

```sql
-- ============================================================
-- REFERENCE / MASTER TABLES
-- ============================================================

CREATE TABLE units (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,       -- 'kWh', 'GJ', 'KL', 'MT', 'm³'
    category    VARCHAR(50) NOT NULL,       -- 'energy', 'volume', 'mass', 'emission'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE emission_factors (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,          -- e.g. 'Grid Electricity - India 2024'
    source          VARCHAR(200),                   -- 'IPCC AR6', 'CEA India'
    scope           ghg_scope NOT NULL,
    activity_unit_id INT NOT NULL REFERENCES units(id),
    factor_value    DECIMAL(18,8) NOT NULL,         -- kgCO2e per unit
    co2_factor      DECIMAL(18,8),
    ch4_factor      DECIMAL(18,8),
    n2o_factor      DECIMAL(18,8),
    valid_from      DATE NOT NULL,
    valid_to        DATE,                           -- NULL = current
    version         INT NOT NULL DEFAULT 1,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE global_warming_potentials (
    id          SERIAL PRIMARY KEY,
    gas_name    VARCHAR(100) NOT NULL,      -- 'CO2', 'CH4', 'N2O', 'HFC-134a'
    formula     VARCHAR(50),
    gwp_100yr   DECIMAL(10,2) NOT NULL,     -- 100-year GWP
    source      VARCHAR(100),               -- 'IPCC AR6'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversion_factors (
    id              SERIAL PRIMARY KEY,
    from_unit_id    INT NOT NULL REFERENCES units(id),
    to_unit_id      INT NOT NULL REFERENCES units(id),
    factor          DECIMAL(18,8) NOT NULL,
    description     VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.4 Data Entry Tables

```sql
-- ============================================================
-- DATA ENTRY TABLES
-- Common pattern: site + month + year = unique entry
-- ============================================================

-- A) PRODUCTION DATA
CREATE TABLE production_data (
    id          SERIAL PRIMARY KEY,
    site_id     INT NOT NULL REFERENCES sites(id),
    month       INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year        INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    quantity_mt DECIMAL(14,4) NOT NULL,         -- Production quantity in MT
    unit_id     INT REFERENCES units(id),
    status      data_status NOT NULL DEFAULT 'draft',
    entered_by  INT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, month, year)
);

-- B) SALES DATA
CREATE TABLE sales_data (
    id          SERIAL PRIMARY KEY,
    site_id     INT NOT NULL REFERENCES sites(id),
    month       INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year        INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    quantity_mt DECIMAL(14,4),
    revenue     DECIMAL(18,2),
    unit_id     INT REFERENCES units(id),
    status      data_status NOT NULL DEFAULT 'draft',
    entered_by  INT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, month, year)
);

-- C) ENERGY & FUEL DATA
CREATE TABLE energy_data (
    id                  SERIAL PRIMARY KEY,
    site_id             INT NOT NULL REFERENCES sites(id),
    month               INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    electricity_kwh     DECIMAL(14,4) DEFAULT 0,
    steam_mt            DECIMAL(14,4) DEFAULT 0,
    coal_mt             DECIMAL(14,4) DEFAULT 0,
    diesel_litres       DECIMAL(14,4) DEFAULT 0,
    fo_litres           DECIMAL(14,4) DEFAULT 0,       -- Furnace Oil
    lpg_kg              DECIMAL(14,4) DEFAULT 0,
    png_scm             DECIMAL(14,4) DEFAULT 0,       -- Piped Natural Gas in SCM
    renewable_kwh       DECIMAL(14,4) DEFAULT 0,
    total_energy_gj     DECIMAL(14,4),                 -- Auto-calculated
    status              data_status NOT NULL DEFAULT 'draft',
    entered_by          INT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, month, year)
);

-- D) WATER DATA
CREATE TABLE water_data (
    id                      SERIAL PRIMARY KEY,
    site_id                 INT NOT NULL REFERENCES sites(id),
    month                   INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                    INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    fresh_water_kl          DECIMAL(14,4) DEFAULT 0,
    recycled_water_kl       DECIMAL(14,4) DEFAULT 0,
    discharge_kl            DECIMAL(14,4) DEFAULT 0,
    total_consumption_kl    DECIMAL(14,4),             -- Auto-calculated
    status                  data_status NOT NULL DEFAULT 'draft',
    entered_by              INT NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, month, year)
);

-- E) ETP DATA
CREATE TABLE etp_data (
    id                  SERIAL PRIMARY KEY,
    site_id             INT NOT NULL REFERENCES sites(id),
    month               INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    cod_mg_per_l        DECIMAL(10,4),
    bod_mg_per_l        DECIMAL(10,4),
    tss_mg_per_l        DECIMAL(10,4),
    tds_mg_per_l        DECIMAL(10,4),
    sludge_mt           DECIMAL(10,4),
    status              data_status NOT NULL DEFAULT 'draft',
    entered_by          INT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, month, year)
);

-- F) AIR EMISSIONS DATA
CREATE TABLE air_emissions_data (
    id              SERIAL PRIMARY KEY,
    site_id         INT NOT NULL REFERENCES sites(id),
    month           INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year            INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    sox_kg          DECIMAL(14,4) DEFAULT 0,
    nox_kg          DECIMAL(14,4) DEFAULT 0,
    pm_kg           DECIMAL(14,4) DEFAULT 0,
    voc_kg          DECIMAL(14,4) DEFAULT 0,
    stack_id        VARCHAR(50),
    status          data_status NOT NULL DEFAULT 'draft',
    entered_by      INT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, month, year, stack_id)
);

-- G) GHG EMISSIONS DATA
CREATE TABLE ghg_emissions (
    id                      SERIAL PRIMARY KEY,
    site_id                 INT NOT NULL REFERENCES sites(id),
    month                   INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                    INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    scope                   ghg_scope NOT NULL,
    scope1_category         scope1_category,
    scope2_method           scope2_method,
    scope3_category         scope3_category,
    source_description      VARCHAR(255) NOT NULL,     -- e.g. 'Diesel - DG Set'
    activity_data           DECIMAL(18,6) NOT NULL,
    activity_unit_id        INT NOT NULL REFERENCES units(id),
    emission_factor_id      INT NOT NULL REFERENCES emission_factors(id),
    co2_tonnes              DECIMAL(14,6),             -- Auto-calculated
    ch4_tonnes              DECIMAL(14,6),
    n2o_tonnes              DECIMAL(14,6),
    co2e_tonnes             DECIMAL(14,6) NOT NULL,    -- Auto-calculated total
    status                  data_status NOT NULL DEFAULT 'draft',
    entered_by              INT NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ghg_site_period ON ghg_emissions(site_id, year, month);
CREATE INDEX idx_ghg_scope ON ghg_emissions(scope);

-- H) RESOURCE RECOVERY (Configurable per site)
CREATE TABLE recovery_data (
    id                  SERIAL PRIMARY KEY,
    site_id             INT NOT NULL REFERENCES sites(id),
    month               INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    material_name       VARCHAR(150) NOT NULL,     -- Configurable
    quantity            DECIMAL(14,4) NOT NULL,
    unit_id             INT NOT NULL REFERENCES units(id),
    revenue             DECIMAL(14,2),
    status              data_status NOT NULL DEFAULT 'draft',
    entered_by          INT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- I) WASTE DATA
CREATE TABLE waste_data (
    id                  SERIAL PRIMARY KEY,
    site_id             INT NOT NULL REFERENCES sites(id),
    month               INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    waste_type          waste_type NOT NULL,
    disposal_method     waste_disposal NOT NULL,
    quantity_mt         DECIMAL(14,4) NOT NULL,
    description         VARCHAR(255),
    status              data_status NOT NULL DEFAULT 'draft',
    entered_by          INT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waste_site_period ON waste_data(site_id, year, month);
```

### 1.5 Targets & Audit Tables

```sql
-- ============================================================
-- TARGETS
-- ============================================================

CREATE TABLE targets (
    id              SERIAL PRIMARY KEY,
    site_id         INT REFERENCES sites(id),       -- NULL = group-level target
    metric_name     VARCHAR(100) NOT NULL,           -- 'carbon_intensity', 'renewable_pct'
    target_year     INT NOT NULL,
    target_value    DECIMAL(14,4) NOT NULL,
    unit_id         INT REFERENCES units(id),
    baseline_year   INT,
    baseline_value  DECIMAL(14,4),
    created_by      INT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (Immutable)
-- ============================================================

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    table_name      VARCHAR(100) NOT NULL,
    record_id       INT NOT NULL,
    action          VARCHAR(10) NOT NULL,            -- 'INSERT', 'UPDATE', 'DELETE'
    old_value       JSONB,
    new_value       JSONB,
    changed_by      INT NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_user ON audit_logs(changed_by);
CREATE INDEX idx_audit_timestamp ON audit_logs(changed_at);

-- Prevent modifications to audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable — UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

### 1.6 Entity Relationship Diagram (Text)

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  users   │────<│user_sites │>────│    sites     │
└──────────┘     └───────────┘     └──────┬───────┘
     │                                     │
     │ entered_by / changed_by             │ site_id (FK in all data tables)
     │                                     │
     ▼                                     ▼
┌──────────────┐                ┌───────────────────┐
│ audit_logs   │                │  production_data  │
└──────────────┘                │  sales_data       │
                                │  energy_data      │
┌──────────────┐                │  water_data       │
│    units     │◄───────────────│  etp_data         │
└──────────────┘  unit_id refs  │  air_emissions    │
                                │  ghg_emissions    │
┌──────────────────┐            │  recovery_data    │
│ emission_factors │◄───────────│  waste_data       │
└──────────────────┘  ef_id     └───────────────────┘
                                         │
┌──────────────┐                         │
│   targets    │─────────────────────────┘ site_id
└──────────────┘

┌──────────────────────────┐    ┌─────────────────────┐
│ global_warming_potentials│    │ conversion_factors  │
└──────────────────────────┘    └─────────────────────┘
```

---

## 2. API Endpoint Contracts

### 2.0 API Specification: OpenAPI 3.0 (Swagger)

All API endpoints are formally defined using the **OpenAPI 3.0 specification** (formerly Swagger). This provides:

| Benefit | Detail |
|---|---|
| **Machine-readable contracts** | `openapi.yaml` file co-located with the backend source |
| **Interactive documentation** | Swagger UI served at `GET /api/docs` (via `swagger-ui-express`) |
| **Client code generation** | Frontend can auto-generate TypeScript API clients using `openapi-typescript-codegen` |
| **Request/response validation** | `express-openapi-validator` middleware validates requests against the spec at runtime |
| **Team communication** | Non-developers can browse API docs in the browser |

**File location:** `backend/src/openapi.yaml`

**Access in browser:** `http://<WSL-IP>:4000/api/docs`

> The endpoint tables below are a human-readable summary; the authoritative spec is `openapi.yaml`.

### 2.1 Base URL

```
http://<WSL-LAN-IP>:4000/api
```

### 2.2 Authentication

| Method | Endpoint | Body | Response | Auth |
|---|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | `{accessToken, refreshToken, user}` | None |
| POST | `/auth/refresh` | `{refreshToken}` | `{accessToken}` | None |
| POST | `/auth/logout` | — | `204` | Bearer |
| GET | `/auth/me` | — | `{user}` | Bearer |

### 2.3 Users (Admin only)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/users` | List all users (paginated) | Admin |
| POST | `/users` | Create user | Admin |
| PUT | `/users/:id` | Update user role / sites | Admin |
| DELETE | `/users/:id` | Deactivate user | Admin |

### 2.4 Sites

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/sites` | List all sites | Any |
| GET | `/sites/:id` | Get site details | Any |
| POST | `/sites` | Create site | Admin |
| PUT | `/sites/:id` | Update site | Admin |

### 2.5 Data Entry (per module)

Pattern: `/data/:module` where `:module` ∈ `{production, sales, energy, water, etp, air-emissions, ghg, recovery, waste}`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/data/:module?siteId=&month=&year=` | Get entries (filtered) | Site User / Admin |
| POST | `/data/:module` | Create entry | Site User / Admin |
| PUT | `/data/:module/:id` | Update entry | Site User / Admin |
| DELETE | `/data/:module/:id` | Delete entry | Admin |

#### Example: POST `/data/energy`

**Request Body:**
```json
{
  "siteId": 1,
  "month": 6,
  "year": 2025,
  "electricityKwh": 125000,
  "steamMt": 0,
  "coalMt": 0,
  "dieselLitres": 450,
  "foLitres": 0,
  "lpgKg": 120,
  "pngScm": 8500,
  "renewableKwh": 35000
}
```

**Response (201):**
```json
{
  "id": 42,
  "siteId": 1,
  "month": 6,
  "year": 2025,
  "electricityKwh": 125000,
  "renewableKwh": 35000,
  "totalEnergyGj": 523.4,
  "status": "draft",
  "enteredBy": 3,
  "createdAt": "2025-06-15T10:30:00Z"
}
```

### 2.6 GHG Emissions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/data/ghg` | Create GHG emission entry (auto-calculates CO₂e) |
| GET | `/data/ghg?siteId=&year=&scope=` | Get emissions filtered by scope |
| GET | `/data/ghg/summary?siteId=&year=` | Aggregated scope 1/2/3 totals |

#### Example: POST `/data/ghg`

**Request:**
```json
{
  "siteId": 1,
  "month": 6,
  "year": 2025,
  "scope": "scope_1",
  "scope1Category": "stationary",
  "sourceDescription": "Diesel - DG Set",
  "activityData": 450,
  "activityUnitId": 5,
  "emissionFactorId": 12
}
```

**Response (201):**
```json
{
  "id": 89,
  "co2Tonnes": 1.188,
  "ch4Tonnes": 0.00005,
  "n2oTonnes": 0.00001,
  "co2eTonnes": 1.203,
  "scope": "scope_1",
  "scope1Category": "stationary"
}
```

### 2.7 Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/summary?siteId=&year=` | KPI summary (all intensities, totals) |
| GET | `/dashboard/emissions-trend?siteId=&yearFrom=&yearTo=` | Monthly emission trend data |
| GET | `/dashboard/site-comparison?year=&metric=` | Cross-site comparison |
| GET | `/dashboard/scope-breakdown?siteId=&year=` | Scope 1/2/3 breakdown |
| GET | `/dashboard/targets?siteId=&year=` | Target vs actual |

#### Example: GET `/dashboard/summary?year=2025`

**Response:**
```json
{
  "totalScope1": 2540.5,
  "totalScope2Location": 4120.3,
  "totalScope2Market": 3890.1,
  "totalScope3": 12400.8,
  "totalGroupEmissions": 19061.6,
  "carbonIntensity": 0.85,
  "energyIntensity": 12.3,
  "waterIntensity": 3.2,
  "wasteIntensity": 0.04,
  "recoveryPct": 72.5,
  "renewableEnergyPct": 28.0,
  "etpCompliancePct": 95.0,
  "productionTotal": 22425.4,
  "unit": "tCO2e"
}
```

### 2.8 Reference Data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reference/units` | All measurement units |
| GET | `/reference/emission-factors?scope=&year=` | Emission factors |
| POST | `/reference/emission-factors` | Create new EF (Admin) |
| PUT | `/reference/emission-factors/:id` | Update EF (creates new version) |
| GET | `/reference/gwp` | Global Warming Potentials |
| GET | `/reference/conversion-factors` | Unit conversion factors |

### 2.9 Import / Export

| Method | Endpoint | Description |
|---|---|---|
| POST | `/import/excel` | Upload Excel file for bulk import (multipart) |
| GET | `/import/template/:module` | Download blank Excel template |
| GET | `/export/excel?module=&siteId=&year=` | Export raw data as .xlsx |
| GET | `/export/pdf/report?siteId=&year=` | Generate PDF report |
| GET | `/export/dashboard/png?dashboardId=` | Export dashboard chart as PNG |

### 2.10 Audit Logs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/audit-logs?table=&recordId=&userId=&from=&to=` | Query audit trail (Admin) |

---

## 3. Authentication & Authorisation Flow

### 3.1 JWT Token Structure

```json
// Access Token Payload (expires: 24 hours)
{
  "sub": 3,
  "email": "user@company.com",
  "role": "site_user",
  "siteIds": [1, 3],
  "iat": 1719000000,
  "exp": 1719086400
}
```

### 3.2 RBAC Middleware Logic

```typescript
// authorize.ts (pseudocode)
function authorize(...allowedRoles: UserRole[]) {
  return (req, res, next) => {
    const user = req.user; // set by authenticate middleware
    
    // 1. Check role
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // 2. Check site access (for non-admin)
    if (user.role !== 'admin') {
      const requestedSiteId = req.body.siteId || req.query.siteId;
      if (requestedSiteId && !user.siteIds.includes(requestedSiteId)) {
        return res.status(403).json({ error: 'No access to this site' });
      }
    }
    
    next();
  };
}
```

### 3.3 Permission Matrix

| Action | Admin | Site User | Viewer |
|---|---|---|---|
| View dashboards | ✅ All sites | ✅ Own sites | ✅ Own sites |
| Enter/edit data | ✅ All sites | ✅ Own sites | ❌ |
| Delete data | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Manage EFs/units | ✅ | ❌ | ❌ |
| Export reports | ✅ | ✅ | ✅ |
| View audit logs | ✅ | ❌ | ❌ |
| Bulk import data | ✅ | ✅ Own sites | ❌ |

---

## 4. GHG Emission Calculation Logic

### 4.1 Core Formula

```
CO₂e (tonnes) = Activity Data × Emission Factor × GWP
```

Where:
- **Activity Data** = amount of fuel, electricity, etc. consumed
- **Emission Factor** = kg CO₂ / kg CH₄ / kg N₂O per unit of activity
- **GWP** = Global Warming Potential (converts to CO₂-equivalent)

### 4.2 Calculation Service (Pseudocode)

```typescript
// ghg.calculator.ts

interface GHGInput {
  activityData: number;
  emissionFactor: EmissionFactor;  // from DB
  gwpTable: Map<string, number>;   // from DB
}

interface GHGResult {
  co2Tonnes: number;
  ch4Tonnes: number;
  n2oTonnes: number;
  co2eTonnes: number;
}

function calculateGHG(input: GHGInput): GHGResult {
  const { activityData, emissionFactor, gwpTable } = input;
  
  // Individual gas emissions (in tonnes)
  const co2 = (activityData * emissionFactor.co2Factor) / 1000;
  const ch4 = (activityData * emissionFactor.ch4Factor) / 1000;
  const n2o = (activityData * emissionFactor.n2oFactor) / 1000;
  
  // Convert to CO2-equivalent using GWP
  const co2e = co2 * gwpTable.get('CO2')!    // GWP = 1
             + ch4 * gwpTable.get('CH4')!     // GWP = 28 (AR5) or 27.9 (AR6)
             + n2o * gwpTable.get('N2O')!;    // GWP = 265 (AR5) or 273 (AR6)
  
  return { co2Tonnes: co2, ch4Tonnes: ch4, n2oTonnes: n2o, co2eTonnes: co2e };
}
```

### 4.3 Intensity Calculations

```typescript
// intensity.calculator.ts

function calculateIntensities(siteId: number, year: number) {
  const production = sumProductionMT(siteId, year);
  
  return {
    carbonIntensity:  totalCO2e / production,           // tCO2e / MT
    energyIntensity:  totalEnergyGJ / production,       // GJ / MT
    waterIntensity:   totalWaterKL / production,         // KL / MT
    wasteIntensity:   totalWasteMT / production,         // MT waste / MT prod
    renewablePct:     (renewableKwh / totalKwh) * 100,
    recoveryPct:      (recoveredMT / totalWasteMT) * 100,
    etpCompliancePct: calculateETPCompliance(siteId, year),
  };
}
```

### 4.4 Energy Conversion Factors (used for total_energy_gj)

| Fuel | Unit | GJ per unit |
|---|---|---|
| Electricity | kWh | 0.0036 |
| Coal | MT | 19.6 |
| Diesel | Litre | 0.0358 |
| Furnace Oil | Litre | 0.0411 |
| LPG | kg | 0.0494 |
| PNG | SCM | 0.0376 |
| Steam | MT | 2.76 |

---

## 5. Frontend Component Hierarchy

```
App
├── AuthProvider
│   ├── LoginPage
│   └── ProtectedRoute
│       └── MainLayout
│           ├── Sidebar (nav links based on role)
│           ├── TopBar (user info, logout, site/period filter)
│           │
│           ├── DashboardPage
│           │   ├── Filters (site, month, year)
│           │   ├── KPICardRow
│           │   │   ├── KPICard (Total Emissions)
│           │   │   ├── KPICard (Carbon Intensity)
│           │   │   ├── KPICard (Renewable %)
│           │   │   └── KPICard (Recovery %)
│           │   ├── TrendLineChart (monthly emissions trend)
│           │   ├── ScopeBreakdownPie (Scope 1/2/3)
│           │   ├── SiteComparisonBar
│           │   ├── IntensityChart (energy, water, waste)
│           │   ├── RenewableGauge
│           │   ├── RecoveryChart
│           │   └── TargetVsActual
│           │
│           ├── DataEntryPage
│           │   ├── ModuleTabs (Energy|Water|Waste|GHG|...)
│           │   └── DataEntryForm
│           │       ├── SiteMonthYearSelector
│           │       ├── FormFields (dynamic per module)
│           │       ├── EmissionFactorDropdown
│           │       └── SubmitButton
│           │
│           ├── ReportsPage
│           │   ├── ReportFilters
│           │   ├── ESGReportingDashboard
│           │   └── ExportButton (PDF / Excel / PNG)
│           │
│           ├── ImportPage
│           │   ├── TemplateDownload
│           │   ├── BulkUpload (drag-and-drop)
│           │   ├── ValidationResults
│           │   └── ImportActions (overwrite / append)
│           │
│           ├── AdminPage (admin only)
│           │   ├── UserManagement
│           │   ├── SiteManagement
│           │   ├── EmissionFactorEditor
│           │   └── UnitManager
│           │
│           └── AuditLogPage (admin only)
│               ├── AuditFilters
│               └── AuditTable
```

### 5.1 Routing Configuration

```typescript
// App.tsx routes
const routes = [
  { path: '/login',       element: <LoginPage />,       auth: false },
  { path: '/',            element: <DashboardPage />,   roles: ['admin', 'site_user', 'viewer'] },
  { path: '/data-entry',  element: <DataEntryPage />,   roles: ['admin', 'site_user'] },
  { path: '/reports',     element: <ReportsPage />,     roles: ['admin', 'site_user', 'viewer'] },
  { path: '/import',      element: <ImportPage />,      roles: ['admin', 'site_user'] },
  { path: '/admin',       element: <AdminPage />,       roles: ['admin'] },
  { path: '/audit-log',   element: <AuditLogPage />,    roles: ['admin'] },
];
```

---

## 6. Backend Module Details

### 6.1 Module Interface Contract

Every backend module follows the same pattern:

```
modules/<name>/
├── <name>.routes.ts       # Express Router with endpoint definitions
├── <name>.controller.ts   # Request handling, calls service, sends response
├── <name>.service.ts      # Business logic, DB queries via Prisma
└── <name>.schema.ts       # Zod validation schemas for request bodies
```

### 6.2 Example: Energy Module

```typescript
// energy.routes.ts
router.get('/', authenticate, authorize('admin', 'site_user', 'viewer'), energyController.list);
router.post('/', authenticate, authorize('admin', 'site_user'), validate(createEnergySchema), energyController.create);
router.put('/:id', authenticate, authorize('admin', 'site_user'), validate(updateEnergySchema), energyController.update);
router.delete('/:id', authenticate, authorize('admin'), energyController.delete);
```

```typescript
// energy.schema.ts (Zod)
const createEnergySchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  electricityKwh: z.number().min(0).default(0),
  steamMt: z.number().min(0).default(0),
  coalMt: z.number().min(0).default(0),
  dieselLitres: z.number().min(0).default(0),
  foLitres: z.number().min(0).default(0),
  lpgKg: z.number().min(0).default(0),
  pngScm: z.number().min(0).default(0),
  renewableKwh: z.number().min(0).default(0),
});
```

```typescript
// energy.service.ts
class EnergyService {
  async create(data: CreateEnergyInput, userId: number) {
    const totalEnergyGj = this.calculateTotalEnergy(data);
    
    const record = await prisma.energyData.create({
      data: { ...data, totalEnergyGj, enteredBy: userId },
    });
    
    await auditLogger.log('energy_data', record.id, 'INSERT', null, record, userId);
    
    return record;
  }
  
  private calculateTotalEnergy(data: CreateEnergyInput): number {
    return (
      data.electricityKwh * 0.0036 +
      data.steamMt * 2.76 +
      data.coalMt * 19.6 +
      data.dieselLitres * 0.0358 +
      data.foLitres * 0.0411 +
      data.lpgKg * 0.0494 +
      data.pngScm * 0.0376 +
      data.renewableKwh * 0.0036
    );
  }
}
```

---

## 7. Docker Configuration

### 7.1 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

### 7.2 Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 7.3 Nginx Config (Frontend Proxy)

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7.4 Environment Variables (.env.example)

```env
# Database
DB_PASSWORD=change_me_in_production
POSTGRES_DB=esg_platform
POSTGRES_USER=esg_admin

# Backend
JWT_SECRET=change_me_to_a_random_64_char_string
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
PORT=4000
DATABASE_URL=postgresql://esg_admin:${DB_PASSWORD}@db:5432/esg_platform
NODE_ENV=production
LOG_LEVEL=info
```

---

## 8. Data Import / Export Pipelines

### 8.1 Excel Import Flow

```mermaid
flowchart TD
    A[User uploads .xlsx file] --> B[Multer receives file]
    B --> C[Parse with ExcelJS]
    C --> D[Map columns to schema]
    D --> E{Validate every row}
    E -- Errors --> F[Return error report\nrow#, column, message]
    E -- All valid --> G{Overwrite or Append?}
    G -- Overwrite --> H[DELETE existing records\nfor site+month+year]
    G -- Append --> I[Skip duplicates]
    H --> J[Bulk INSERT validated rows]
    I --> J
    J --> K[Write audit logs]
    K --> L[Return import summary\nimported: N, skipped: M]
```

### 8.2 Excel Template Structure

Each module has a downloadable `.xlsx` template with:
- **Row 1:** Column headers matching the API field names
- **Row 2:** Example data with comments explaining each field
- **Data Validation:** Dropdowns for site names, units, scopes, waste types

### 8.3 PDF Report Structure

```
┌─────────────────────────────────┐
│  ESG Performance Report         │
│  [Site Name] | FY 2025          │
├─────────────────────────────────┤
│  1. Executive Summary           │
│     - Total Emissions (tCO2e)   │
│     - Carbon Intensity          │
│     - Year-on-Year change       │
├─────────────────────────────────┤
│  2. GHG Emissions Breakdown    │
│     [Scope Pie Chart - PNG]     │
│     [Monthly Trend - PNG]       │
├─────────────────────────────────┤
│  3. Energy & Water              │
│     [Intensity Table]           │
│     [Renewable Share Graph]     │
├─────────────────────────────────┤
│  4. Waste Management            │
│     [Disposal Breakdown]        │
│     [Recovery Efficiency]       │
├─────────────────────────────────┤
│  5. Target vs Actual            │
│     [Comparison Table]          │
└─────────────────────────────────┘
```

---

## 9. Audit Trail Implementation

### 9.1 Middleware Approach

The audit logger is implemented as a **service** called by each module's service layer (not as Express middleware — this allows capturing old/new values within the same transaction).

```typescript
// auditLogger.ts
class AuditLogger {
  async log(
    tableName: string,
    recordId: number,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    oldValue: object | null,
    newValue: object | null,
    changedBy: number
  ) {
    await prisma.auditLog.create({
      data: {
        tableName,
        recordId,
        action,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        changedBy,
      },
    });
  }
}
```

### 9.2 Usage in Service (Update Example)

```typescript
async update(id: number, data: UpdateInput, userId: number) {
  const oldRecord = await prisma.energyData.findUniqueOrThrow({ where: { id } });
  
  const updated = await prisma.energyData.update({
    where: { id },
    data: { ...data, totalEnergyGj: this.calculateTotalEnergy(data) },
  });
  
  await auditLogger.log('energy_data', id, 'UPDATE', oldRecord, updated, userId);
  
  return updated;
}
```

### 9.3 Immutability

The PostgreSQL trigger defined in section 1.5 prevents any `UPDATE` or `DELETE` on the `audit_logs` table, ensuring an immutable trail.

---

## 10. Telemetry & Logging (Backend)

### 10.1 Logger Configuration

```typescript
// src/config/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'esg-backend' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,  // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});
```

### 10.2 HTTP Request Logging (Morgan)

```typescript
// In app.ts
import morgan from 'morgan';

app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim(), { type: 'http' }) },
}));
```

### 10.3 Frontend Error Telemetry Endpoint

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/telemetry/error` | Receives frontend error reports (error boundary, unhandled rejections) |
| POST | `/api/telemetry/vitals` | Receives web-vitals performance metrics (LCP, FID, CLS) |

---

## 11. Testing Infrastructure

### 11.1 Backend Test Configuration

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
```

```typescript
// jest.setup.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

beforeAll(async () => {
  // Run migrations on test DB
  // DATABASE_URL should point to esg_platform_test
});

afterEach(async () => {
  // Truncate all tables between tests
  const tables = await prisma.$queryRaw<{tablename: string}[]>
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 11.2 Sample Backend Test: GHG Calculator

```typescript
// modules/calculations/__tests__/ghg.calculator.test.ts
import { calculateGHG } from '../ghg.calculator';

describe('GHG Calculator', () => {
  const gwpTable = new Map([['CO2', 1], ['CH4', 27.9], ['N2O', 273]]);

  it('calculates CO2e for diesel combustion', () => {
    const result = calculateGHG({
      activityData: 1000,              // 1000 litres
      emissionFactor: {
        co2Factor: 2.68,               // kg CO2 per litre
        ch4Factor: 0.0001,
        n2oFactor: 0.00001,
      },
      gwpTable,
    });

    expect(result.co2Tonnes).toBeCloseTo(2.68, 4);
    expect(result.co2eTonnes).toBeCloseTo(2.6856, 2);
  });

  it('returns zero for zero activity data', () => {
    const result = calculateGHG({
      activityData: 0,
      emissionFactor: { co2Factor: 2.68, ch4Factor: 0.0001, n2oFactor: 0.00001 },
      gwpTable,
    });
    expect(result.co2eTonnes).toBe(0);
  });
});
```

### 11.3 Sample Integration Test: Auth API

```typescript
// modules/auth/__tests__/auth.routes.test.ts
import request from 'supertest';
import app from '../../../app';

describe('POST /api/auth/login', () => {
  it('returns JWT for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@esg.local', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.role).toBe('admin');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@esg.local', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });
});
```

### 11.4 Frontend Test Example: KPICard

```typescript
// components/charts/__tests__/KPICard.test.tsx
import { render, screen } from '@testing-library/react';
import { KPICard } from '../KPICard';

describe('KPICard', () => {
  it('renders label and value', () => {
    render(<KPICard label="Carbon Intensity" value={0.85} unit="tCO2e/MT" />);
    expect(screen.getByText('Carbon Intensity')).toBeInTheDocument();
    expect(screen.getByText('0.85')).toBeInTheDocument();
  });

  it('shows trend indicator for positive change', () => {
    render(<KPICard label="Emissions" value={1200} trend={5.2} />);
    expect(screen.getByText('▲ 5.2%')).toBeInTheDocument();
  });
});
```

### 11.5 Docker Compose Test Profile

```yaml
# docker-compose.yml (test profile addition)
services:
  test-db:
    image: postgres:16-alpine
    profiles: ["test"]
    environment:
      POSTGRES_DB: esg_platform_test
      POSTGRES_USER: esg_admin
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
```

```bash
# Run integration tests with test DB
docker compose --profile test up -d test-db
DATABASE_URL=postgresql://esg_admin:test_password@localhost:5433/esg_platform_test \
  npm run test:integration
```

---

## 12. Seed Data

On first startup, the seed script (`prisma/seed.ts`) populates:

| Table | Seed Content |
|---|---|
| `sites` | Taloja, Daman, Baddi, Tiljala, Sion, Indonesia |
| `users` | One admin user (admin@esg.local / admin123) |
| `units` | kWh, GJ, KL, MT, m³, litres, SCM, kg, tCO₂e |
| `emission_factors` | IPCC AR6 defaults for common fuels |
| `global_warming_potentials` | CO₂=1, CH₄=27.9, N₂O=273 (AR6) |
| `conversion_factors` | Energy unit conversions (see §4.4) |

---

> **This LLD, together with the [HLD](file:///home/dmamodiya/test/ESGWebApp/Docs/Design%20Docs/HLD.md), provides the complete technical specification to begin building the ESG Web Application POC.**
