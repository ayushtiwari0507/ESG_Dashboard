# Testing Guide

## Table of Contents

- [Overview](#overview)
- [Framework Choices & Rationale](#framework-choices--rationale)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Coverage](#coverage)
- [Debugging Tests](#debugging-tests)
- [Mock Patterns & Conventions](#mock-patterns--conventions)
- [Writing New Tests](#writing-new-tests)
- [CI Integration](#ci-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

| Layer | Framework | Runner | Test Types | Test Count |
|-------|-----------|--------|------------|------------|
| Backend | Jest 30 + ts-jest 29 | Node.js | Unit, Integration | 246 |
| Frontend | Vitest 4 + @testing-library/react 16 | jsdom | Component, Context | 16 |

**No real database or running server is needed** — all external dependencies are mocked at the module level. Tests run in full isolation and are suitable for local development and CI pipelines alike.

---

## Framework Choices & Rationale

### Backend: Jest + ts-jest + supertest

| Tool | Version | Purpose | Why This Choice |
|------|---------|---------|----------------|
| **Jest** | 30.x | Test runner & assertion library | Industry standard for Node.js. Built-in mocking (`jest.fn()`, `jest.mock()`), snapshot testing, coverage collection, parallel execution, and watch mode. Single dependency replaces mocha + chai + sinon + nyc. |
| **ts-jest** | 29.x | TypeScript transformer for Jest | Runs `.ts` files directly without a separate build step. Supports `tsconfig.json` paths. Faster feedback loop than compiling first. |
| **supertest** | 7.x | HTTP assertion library | Boots the Express app in-process (no port binding) and sends real HTTP requests. Tests the full middleware chain (auth, validation, error handling) exactly as production handles them. |

**Why not Mocha/Chai?** Jest provides an all-in-one solution (runner + assertions + mocks + coverage). Mocha requires assembling multiple libraries. Jest's module-level mocking (`jest.mock()`) is critical for isolating Prisma calls without a test database.

**Why not Vitest for backend?** Vitest requires ESM, while our backend uses CommonJS (`tsconfig.json` targets `commonjs`). Jest's mature ecosystem and ts-jest handle this seamlessly.

### Frontend: Vitest + @testing-library/react

| Tool | Version | Purpose | Why This Choice |
|------|---------|---------|----------------|
| **Vitest** | 4.x | Test runner | Native Vite integration — shares the same config, plugins, and transform pipeline. Hot module reload in watch mode. 10-20x faster startup than Jest for Vite projects. |
| **@testing-library/react** | 16.x | Component testing | Tests components the way users interact with them (by text, role, label) rather than implementation details. Encourages accessible markup. |
| **@testing-library/user-event** | 14.x | User interaction simulation | Fires realistic browser events (focus, keydown, input, blur) instead of synthetic `fireEvent`. Catches more real-world bugs. |
| **jsdom** | 28.x | DOM environment | Lightweight browser simulation for Node.js. Sufficient for React component testing without a real browser. |
| **@vitest/coverage-v8** | 4.x | Coverage collection | V8's native coverage is faster and more accurate than Istanbul for ESM/Vite projects. |

**Why not Jest for frontend?** Our frontend uses Vite with ESM. Jest requires complex `transformIgnorePatterns` and `moduleNameMapper` configuration for ESM + JSX. Vitest works out of the box with the existing `vite.config.ts`.

---

## Test Architecture

### Backend Test Structure

```
backend/src/__tests__/
├── setup.ts                                    # Global mock setup (prisma, logger)
├── integration/                                # Full HTTP request cycle tests
│   ├── routes.test.ts                          # Core API routes (17 tests)
│   ├── data-crud.test.ts                       # All 9 data modules via factory (117 tests)
│   ├── dashboard.test.ts                       # Dashboard aggregation endpoints (15 tests)
│   └── admin-auth.test.ts                      # Auth, Users, Audit, Sites, Telemetry (58 tests)
└── unit/                                       # Isolated function/class tests
    ├── config/
    │   └── config.test.ts                      # env.ts defaults, logger.ts setup (12 tests)
    ├── middleware/
    │   ├── authenticate.test.ts                # JWT verification (5 tests)
    │   ├── authorize.test.ts                   # Role-based access (8 tests)
    │   ├── validate.test.ts                    # Zod schema validation (4 tests)
    │   ├── errorHandler.test.ts                # Error formatting (3 tests)
    │   └── auditLogger.test.ts                 # Audit trail logging (5 tests)
    └── modules/
        ├── auth.schema.test.ts                 # Login schema validation (7 tests)
        ├── auth.service.test.ts                # AuthService business logic (8 tests)
        ├── auth.controller.test.ts             # AuthController handlers (7 tests)
        ├── energy.schema.test.ts               # Energy schema validation (7 tests)
        └── energy.service.test.ts              # EnergyService + calculations (12 tests)

15 test files | 246 tests | 99%+ coverage
```

### Frontend Test Structure

```
frontend/src/__tests__/
├── setup.ts                                    # jest-dom matchers, localStorage mock
├── App.test.tsx                                # Router + loading state (2 tests)
├── api/
│   └── client.test.ts                          # Axios instance config (1 test)
├── auth/
│   └── AuthContext.test.tsx                     # Auth provider lifecycle (6 tests)
└── pages/
    └── LoginPage.test.tsx                      # Login form interactions (7 tests)

4 test files | 16 tests
```

### Integration vs Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| **What's tested** | Single function/class in isolation | Full HTTP request → response cycle |
| **HTTP layer** | Not involved | supertest sends real HTTP requests |
| **Middleware** | Mocked or tested individually | Full chain: auth → validate → handler → error |
| **Database** | Prisma methods mocked | Prisma methods mocked |
| **Speed** | ~1-5ms per test | ~10-50ms per test |
| **Use when** | Testing business logic, calculations | Testing route wiring, status codes, auth |

---

## Running Tests

### Backend

```bash
cd backend

# Run all tests
npx jest

# Run only unit tests
npm run test:unit
# Equivalent: npx jest --testPathPattern=unit

# Run only integration tests
npm run test:integration
# Equivalent: npx jest --testPathPattern=integration

# Run all tests with coverage report
npm run test:coverage
# Equivalent: npx jest --coverage

# Run a single test file
npx jest --testPathPattern=data-crud

# Run tests matching a name pattern
npx jest -t "should create energy"

# Watch mode (re-runs on file change)
npx jest --watch

# Watch only changed files (requires git)
npx jest --watchAll

# Verbose output (shows every test name)
npx jest --verbose

# Run tests in a specific directory
npx jest src/__tests__/unit/middleware/

# Bail on first failure
npx jest --bail
```

### Frontend

```bash
cd frontend

# Run all tests (interactive watch mode)
npm run test
# Equivalent: vitest

# Run all tests once (CI mode)
npx vitest run

# Run with coverage
npm run test:ci
# Equivalent: vitest run --coverage

# Run a single test file
npx vitest run src/__tests__/pages/LoginPage.test.tsx

# Run tests matching a name pattern
npx vitest run -t "should display error"

# Watch mode
npx vitest

# Verbose output
npx vitest --reporter=verbose
```

---

## Coverage

### Backend Coverage Thresholds

Coverage gates are enforced in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
},
```

**If coverage drops below 90% on any metric, `npm run test:coverage` will fail.** This prevents merging PRs that reduce coverage.

### Current Coverage (Backend)

| Metric | Coverage | Threshold |
|--------|----------|-----------|
| Statements | 99.03% | 90% |
| Branches | 94.44% | 90% |
| Functions | 100% | 90% |
| Lines | 98.94% | 90% |

### Viewing Coverage Reports

```bash
cd backend
npm run test:coverage

# Terminal output shows a per-file table
# HTML report generated at:
open coverage/lcov-report/index.html
```

Coverage reports are generated in these formats:

| Format | Location | Usage |
|--------|----------|-------|
| `text` | Terminal stdout | Quick review during development |
| `text-summary` | Terminal stdout | One-line summary |
| `lcov` | `coverage/lcov-report/index.html` | Interactive HTML report |
| `clover` | `coverage/clover.xml` | CI tool integration |

### Excluded from Coverage

These files are excluded via `collectCoverageFrom` in `jest.config.js`:

| File | Reason |
|------|--------|
| `src/index.ts` | Server bootstrap — only calls `app.listen()` |
| `src/config/database.ts` | Prisma client instantiation — mocked in tests |
| `src/**/*.d.ts` | Type declarations — no runtime code |

### Frontend Coverage

```bash
cd frontend
npm run test:ci    # Generates coverage via @vitest/coverage-v8
```

---

## Debugging Tests

### Method 1: Verbose Output

The quickest approach — add `--verbose` for full test names and `console.log()` for data inspection:

```bash
npx jest --verbose --testPathPattern=energy.service
```

### Method 2: Run a Single Test in Isolation

Narrow to the failing test to eliminate interference from other tests:

```bash
# By file
npx jest --testPathPattern=auth.controller

# By test name
npx jest -t "should return 401 for invalid password"

# Combined
npx jest --testPathPattern=auth.controller -t "401"
```

### Method 3: VS Code Debugger

Use the launch configurations in `.vscode/launch.json`:

1. Open the test file you want to debug
2. Set breakpoints by clicking the gutter
3. Press `F5` or go to **Run and Debug** panel
4. Select **"Jest: Debug Current File"** (backend) or **"Vitest: Debug Current File"** (frontend)
5. The debugger will stop at your breakpoints

Available launch configurations:

| Config | What It Does |
|--------|-------------|
| Jest: Debug Current File | Runs the open test file with `--inspect-brk` |
| Jest: Debug All Tests | Runs all backend tests with debugger attached |
| Vitest: Debug Current File | Runs the open frontend test with debugger |

### Method 4: Node.js Inspector (Terminal)

```bash
# Backend — attach Chrome DevTools
cd backend
node --inspect-brk node_modules/.bin/jest --runInBand --testPathPattern=energy.service

# Then open chrome://inspect in Chrome and click "inspect"
```

### Method 5: Jest `--detectOpenHandles`

If tests hang (don't exit), find the culprit:

```bash
npx jest --detectOpenHandles --forceExit
```

### Debugging Tips

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Test passes alone, fails in suite | Mock state leaking between tests | Add `mockReset()` in `beforeEach` |
| `Cannot find module` | Wrong relative path in mock | Count directory depth from test file to source |
| `received undefined` | Mock not returning expected value | Check `mockResolvedValueOnce` queue order |
| Prisma method not mocked | Wrong method name | Verify source uses `findUnique` vs `findUniqueOrThrow` |
| Tests hang | Unresolved promise or timer | Use `--detectOpenHandles` and `--forceExit` |
| Coverage lower than expected | New code without tests | Run `--coverage` and check the per-file table |

---

## Mock Patterns & Conventions

### Pattern 1: Prisma Module Mock (Used Everywhere)

All tests mock the entire Prisma module at the top of the file:

```typescript
// This replaces the real Prisma client with jest.fn() for every method
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    energyData: {
      findMany: jest.fn(),
      create: jest.fn(),
      // ... add methods as needed
    },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
```

**Why?** Prisma requires a running database. By mocking at the module level, we test business logic without any database dependency. The `jest.mock()` call is hoisted to the top of the file by Jest.

### Pattern 2: Logger Mock (Used Everywhere)

```typescript
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
```

**Why?** Prevents log output from cluttering test results and allows asserting that specific messages were logged.

### Pattern 3: Factory Pattern for Data CRUD Tests

The `data-crud.test.ts` file uses a factory to avoid duplicating identical test logic across 9 data modules:

```typescript
function runDataModuleTests(cfg: {
  name: string;           // e.g., 'energy'
  route: string;          // e.g., '/api/2026-02-24/data/energy'
  prismaModel: string;    // e.g., 'energyData'
  samplePayload: object;  // Valid POST body
  sampleRecord: object;   // What Prisma returns
  hasDelete?: boolean;     // false for water (no DELETE route)
}) {
  describe(`${cfg.name} CRUD`, () => {
    // POST, PUT, DELETE, GET tests generated from config
  });
}
```

**Why?** All 9 data modules (energy, production, water, waste, ETP, GHG, air emissions, sales, recovery) follow the same route pattern. The factory eliminates ~1000 lines of duplicate test code.

### Pattern 4: Mock Reset in `beforeEach`

```typescript
beforeEach(() => {
  // Reset all mock call history AND implementation
  Object.values(prisma.user).forEach((fn: any) => {
    if (typeof fn?.mockReset === 'function') fn.mockReset();
  });

  // Re-establish default mock behavior
  (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.user.count as jest.Mock).mockResolvedValue(0);
});
```

**Why?** Jest's `clearMocks: true` only clears call history, not queued `mockResolvedValueOnce` values. Without `mockReset()`, unconsumed mock values from one test pollute the next test's mock queue. This was the root cause of several test failures during development.

### Pattern 5: Environment Variable Manipulation

```typescript
describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();                    // Clear module cache
    process.env = { ...originalEnv };       // Fresh copy
    process.env.JWT_SECRET = 'test-secret'; // Required var
  });

  afterAll(() => {
    process.env = originalEnv;              // Restore
  });

  it('uses PORT from env', () => {
    process.env.PORT = '5000';
    const { env } = require('../../../config/env');
    expect(env.PORT).toBe(5000);
  });
});
```

**Why?** Config modules read `process.env` at import time. `jest.resetModules()` ensures each test gets a fresh import. Without it, the first import's cached values would be used for all tests.

---

## Writing New Tests

### Adding a Backend Unit Test

1. Create the file in the appropriate directory:
   ```
   backend/src/__tests__/unit/modules/myService.test.ts
   ```

2. Follow this template:
   ```typescript
   // 1. Mock external dependencies FIRST (hoisted by Jest)
   jest.mock('../../../config/database', () => ({
     __esModule: true,
     default: {
       myModel: {
         findMany: jest.fn(),
         create: jest.fn(),
       },
       auditLog: { create: jest.fn() },
     },
   }));

   jest.mock('../../../config/logger', () => ({
     __esModule: true,
     default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
   }));

   // 2. Import AFTER mocks are declared
   import prisma from '../../../config/database';
   import { myService } from '../../../modules/myModule/myModule.service';

   describe('MyService', () => {
     beforeEach(() => {
       jest.clearAllMocks();
     });

     describe('list', () => {
       it('should return all records', async () => {
         const mockData = [{ id: 1, name: 'Test' }];
         (prisma.myModel.findMany as jest.Mock).mockResolvedValue(mockData);

         const result = await myService.list({});
         expect(result).toEqual(mockData);
         expect(prisma.myModel.findMany).toHaveBeenCalledWith({ where: {} });
       });
     });
   });
   ```

3. Run the test:
   ```bash
   npx jest --testPathPattern=myService --verbose
   ```

### Adding a Backend Integration Test

1. Create the file:
   ```
   backend/src/__tests__/integration/myRoute.test.ts
   ```

2. Follow this template:
   ```typescript
   jest.mock('../../config/database', () => ({ /* mock prisma */ }));
   jest.mock('../../config/logger', () => ({ /* mock logger */ }));

   // Set JWT_SECRET before importing app
   process.env.JWT_SECRET = 'test-secret';

   import request from 'supertest';
   import app from '../../app';
   import jwt from 'jsonwebtoken';
   import prisma from '../../config/database';

   const token = jwt.sign(
     { id: 1, email: 'admin@test.com', role: 'admin' },
     process.env.JWT_SECRET!
   );

   describe('GET /api/my-route', () => {
     it('should return 200 with data', async () => {
       (prisma.myModel.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);

       const res = await request(app)
         .get('/api/my-route')
         .set('Authorization', `Bearer ${token}`);

       expect(res.status).toBe(200);
       expect(res.body).toHaveLength(1);
     });

     it('should return 401 without token', async () => {
       const res = await request(app).get('/api/my-route');
       expect(res.status).toBe(401);
     });
   });
   ```

### Adding a Frontend Component Test

1. Create the file:
   ```
   frontend/src/__tests__/pages/MyPage.test.tsx
   ```

2. Follow this template:
   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   import { render, screen, waitFor } from '@testing-library/react';
   import userEvent from '@testing-library/user-event';
   import { BrowserRouter } from 'react-router-dom';
   import MyPage from '../../pages/MyPage';

   // Mock API client
   vi.mock('../../api/client', () => ({
     default: {
       get: vi.fn(),
       post: vi.fn(),
     },
   }));

   const renderWithRouter = (ui: React.ReactElement) =>
     render(<BrowserRouter>{ui}</BrowserRouter>);

   describe('MyPage', () => {
     it('renders the page title', () => {
       renderWithRouter(<MyPage />);
       expect(screen.getByText('My Page')).toBeInTheDocument();
     });

     it('handles form submission', async () => {
       const user = userEvent.setup();
       renderWithRouter(<MyPage />);

       await user.type(screen.getByLabelText('Name'), 'Test');
       await user.click(screen.getByRole('button', { name: /submit/i }));

       await waitFor(() => {
         expect(screen.getByText('Success')).toBeInTheDocument();
       });
     });
   });
   ```

### Naming Conventions

| Convention | Example |
|-----------|---------|
| Test file name | `<source-file>.test.ts` or `<feature>.test.ts` |
| Describe block | `describe('ClassName')` or `describe('GET /api/route')` |
| Test name | `it('should return 200 when user is admin')` |
| Always start with | `should ...` for consistency |

---

## CI Integration

Both backend and frontend test suites run without external dependencies. Example CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd backend && npm ci
      - run: cd backend && npx prisma generate
      - run: cd backend && npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: backend/coverage/lcov-report/

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:ci

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

### CI Commands (Quick Reference)

```bash
# Backend — all tests with coverage enforcement (fails below 90%)
cd backend && npx jest --ci --coverage

# Backend — JUnit report for CI tools
cd backend && npx jest --ci --coverage --reporters=default --reporters=jest-junit

# Frontend — single run with coverage
cd frontend && npx vitest run --coverage

# Frontend — JUnit report
cd frontend && npx vitest run --coverage --reporter=junit

# Credential scanning
cd backend && npm run secrets:scan
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|---------|
| `Cannot find module '../config/database'` | Wrong import path depth | Count dirs from test file: `unit/modules/` = `../../../`, `integration/` = `../../` |
| Tests pass individually but fail together | Mock state leaking | Add `mockReset()` in `beforeEach`, not just `clearMocks` |
| `received undefined` from mock | Mock queue exhausted or wrong method | Check `mockResolvedValueOnce` vs `mockResolvedValue` (once = single use) |
| Coverage drops after adding code | New code path has no test | Check `coverage/lcov-report/index.html` for uncovered lines |
| `jest.config.js` validation warning | Typo in config key | Use exact keys: `setupFiles` (not `setupFilesAfterSetup`) |
| Frontend test: `document is not defined` | Missing jsdom environment | Ensure `vitest.config.ts` has `environment: 'jsdom'` |
| `prisma.model.findUniqueOrThrow is not a function` | Mock doesn't have method | Add the method to the Prisma mock object |
| Tests hang / don't exit | Unresolved async operation | Run with `--detectOpenHandles --forceExit` |
| `EADDRINUSE` during tests | Tests binding to port | supertest creates its own ephemeral port — don't call `app.listen()` in tests |
| Rate limiter failing tests | Too many requests in test suite | Rate limiter is per-IP; tests share the same IP. Add `app.set('trust proxy', ...)` or reset limiter between tests |
