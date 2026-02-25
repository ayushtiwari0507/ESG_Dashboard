# Testing & Test Debugging TSG

## Diagnostic Checklist

Run through these checks in order when tests fail:

```bash
# 1. Are dependencies installed?
cd backend && npm ls jest ts-jest supertest

# 2. Is Prisma client generated?
npx prisma generate

# 3. Do all tests pass?
npx jest --verbose 2>&1 | tail -40

# 4. What's the coverage?
npx jest --coverage 2>&1 | tail -30

# 5. Does the failing test pass in isolation?
npx jest --testPathPattern=<failing-file> --verbose

# 6. Is it a mock ordering issue?
npx jest --testPathPattern=<failing-file> --verbose --runInBand
```

---

## 1. Test Won't Run (Compilation Error)

### Symptoms
- `Cannot find module '...'`
- `SyntaxError: Unexpected token`
- `TypeError: jest.fn is not a function`

### Debugging Steps

```bash
# Check TypeScript compilation
cd backend && npx tsc --noEmit

# Verify ts-jest is configured
cat jest.config.js | grep preset
# Should show: preset: 'ts-jest'

# Check the import path from the test file
# Count directory depth:
#   integration/  → ../../config/database
#   unit/modules/ → ../../../config/database
#   unit/config/  → ../../../config/database

# Verify the module exists at the import path
ls -la src/config/database.ts
ls -la src/modules/energy/energy.service.ts
```

### Common Fixes

| Error | Fix |
|-------|-----|
| `Cannot find module '../../config/database'` | Wrong depth — unit tests need `../../../` |
| `SyntaxError: Cannot use import statement` | Missing `ts-jest` preset in `jest.config.js` |
| `Module not found: ./setup` | `setupFiles` path doesn't match file location |

---

## 2. Test Passes Alone, Fails in Suite

### Symptoms
- Test passes with `npx jest --testPathPattern=<file>`
- Same test fails with `npx jest` (full suite run)
- Failures change depending on test execution order

### Root Cause: Mock State Leaking

Jest's `clearMocks: true` only resets call counts and return values **set via `mockReturnValue()`**. It does NOT clear queued values from `.mockResolvedValueOnce()`.

```typescript
// Test A (earlier in suite)
(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 1 });
// Test A doesn't consume this mock (maybe it tests a different path)

// Test B (later in suite)  
// Expects findUnique to return undefined, but gets { id: 1 } from Test A's queue!
```

### Fix: Use `mockReset()` in `beforeEach`

```typescript
beforeEach(() => {
  // mockReset clears EVERYTHING: calls, instances, implementations, AND queued values
  Object.values(prisma.user).forEach((fn: any) => {
    if (typeof fn?.mockReset === 'function') fn.mockReset();
  });
  
  // Re-establish default mock behavior after reset
  (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.user.count as jest.Mock).mockResolvedValue(0);
});
```

### Difference Between Mock Reset Methods

| Method | Clears Calls | Clears Implementation | Clears Queue |
|--------|-------------|----------------------|-------------|
| `mockClear()` | ✅ | ❌ | ❌ |
| `mockReset()` | ✅ | ✅ | ✅ |
| `mockRestore()` | ✅ | ✅ (restores original) | ✅ |
| `clearMocks: true` (config) | ✅ (all mocks) | ❌ | ❌ |

---

## 3. Mock Returns Unexpected Value

### Symptoms
- `expect(received).toEqual(expected)` — received is `undefined` or wrong data
- Mock function was called but returned wrong result

### Debugging Steps

```typescript
// Add this BEFORE the assertion that fails:
console.log('Mock calls:', (prisma.user.findUnique as jest.Mock).mock.calls);
console.log('Mock results:', (prisma.user.findUnique as jest.Mock).mock.results);

// Check: Is the right method being mocked?
// The source code might use findUnique, but you mocked findUniqueOrThrow
// Or vice versa. Check the actual source file:
grep "findUnique" src/modules/auth/auth.service.ts
```

### Common Pitfalls

| Mistake | Fix |
|---------|-----|
| Mocked `findUniqueOrThrow`, source uses `findUnique` | Match the exact method name from source code |
| Used `mockResolvedValue` expecting it to be consumed once | Use `mockResolvedValueOnce` for sequential calls |
| Mocked the wrong Prisma model | Check model name matches `schema.prisma` (camelCase: `energyData`, not `energy_data`) |
| Forgot `__esModule: true` in mock | Required for default exports: `import prisma from '...'` |

---

## 4. Integration Test Returns Wrong Status Code

### Symptoms
- Expected 200, got 401 (auth issue)
- Expected 201, got 400 (validation issue)
- Expected 404, got 500 (error handling issue)

### Debugging Steps

```bash
# Run the specific test with verbose logging
npx jest --testPathPattern=routes -t "should create" --verbose

# Add response body logging in the test
const res = await request(app).post('/api/data/energy')
  .set('Authorization', `Bearer ${token}`)
  .send(payload);
console.log('Status:', res.status);
console.log('Body:', JSON.stringify(res.body, null, 2));
```

### Checklist

| Check | How |
|-------|-----|
| JWT token valid? | Ensure `jwt.sign()` uses the same secret as `process.env.JWT_SECRET` |
| Token has correct role? | `jwt.sign({ id: 1, email: '...', role: 'admin' }, ...)` — admin needed for DELETE |
| Request body matches Zod schema? | Compare payload with the schema in `*.schema.ts` |
| Prisma mock set up BEFORE request? | `mockResolvedValueOnce()` must be called before `request(app).post(...)` |
| Route exists in `app.ts`? | `grep "energy" src/app.ts` — check the route is registered |

---

## 5. Coverage Below Threshold

### Symptoms
- `Jest: "global" coverage threshold for statements (90%) not met: X%`
- CI pipeline fails on coverage check

### Debugging Steps

```bash
# Run coverage and check per-file breakdown
npx jest --coverage 2>&1 | grep -E "^\s*(Stmts|src/)" | head -30

# Open the HTML report for line-by-line details
npx jest --coverage
open coverage/lcov-report/index.html
# or: python3 -m http.server -d coverage/lcov-report 8888
```

### How to Read the Coverage Report

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines
src/modules/water/...   |   85.71 |    66.67 |   80.00 |   84.21 | 45-52,78
```

- **Uncovered Lines** tells you exactly which lines need tests
- **% Branch** is usually lowest — add tests for `if/else` paths, error cases, and edge conditions
- Focus on files with lowest coverage first

### Strategy to Increase Coverage

1. **Error paths**: Test what happens when Prisma throws (`mockRejectedValueOnce(new Error(...))`)
2. **Validation failures**: Send invalid data to see 400 responses
3. **Auth edge cases**: No token, expired token, wrong role
4. **Prisma P2025 errors**: Test record-not-found paths (`{ code: 'P2025' }`)
5. **Query filter combinations**: Test GET routes with `?siteId=1&month=1&year=2025`

---

## 6. Environment/Config Test Issues

### Symptoms
- `env.JWT_SECRET` always returns the same value despite `process.env` changes
- Config module caches first import value

### Root Cause

Node.js caches module imports. Once `env.ts` is imported, `process.env` reads are cached:

```typescript
// env.ts runs ONCE at first import
export const env = { PORT: parseInt(process.env.PORT || '4000') };
// Changing process.env.PORT later has NO effect
```

### Fix: Use `jest.resetModules()`

```typescript
beforeEach(() => {
  jest.resetModules();                    // Clear module cache
  process.env = { ...originalEnv };       // Fresh env copy
  process.env.JWT_SECRET = 'test-secret'; // Set required vars
});

it('reads PORT from env', () => {
  process.env.PORT = '5000';
  const { env } = require('../../../config/env'); // Fresh import
  expect(env.PORT).toBe(5000);
});
```

---

## 7. Tests Hang (Don't Exit)

### Symptoms
- Jest shows all tests passed but doesn't exit
- Terminal hangs after "Tests: X passed, X total"

### Debugging Steps

```bash
# Find the handle keeping the process alive
npx jest --detectOpenHandles --forceExit

# Common output:
# ● Jest has detected the following 1 open handle:
#   TCPSERVERWRAP
#   at Server.listen (net.js:...)
```

### Common Causes

| Cause | Fix |
|-------|-----|
| `app.listen()` called during import | Separate `app.ts` (exports app) from `index.ts` (calls listen) |
| Database connection open | Mock `prisma` at module level (which we do) |
| Timer/interval running | Clear in `afterAll(() => clearInterval(...))` |
| Unclosed HTTP connection | supertest handles this automatically if using `request(app)` not `request(url)` |

---

## 8. VS Code Test Debugger Not Working

### Symptoms
- Breakpoints not hit
- Debugger doesn't start
- "Could not connect to debug target"

### Checklist

1. **Ensure `.vscode/launch.json` exists** with Jest/Vitest debug configurations
2. **Open the test file** before pressing F5 (the "Current File" configs use `${file}`)
3. **Check `--runInBand`** is in the launch args (parallel execution skips breakpoints)
4. **Rebuild if needed**: `npx tsc --noEmit` to check for compile errors first

### Manual Debugger Connection

```bash
# Start Jest with inspector
cd backend
node --inspect-brk node_modules/.bin/jest --runInBand --testPathPattern=auth

# Output: Debugger listening on ws://127.0.0.1:9229/...
# Open Chrome → chrome://inspect → Click "inspect" on the Node target
# Set breakpoints in Chrome DevTools → Resume execution
```

---

## 9. Frontend Test Issues (Vitest)

### Symptoms
- `document is not defined`
- `ReferenceError: window is not defined`
- Component rendering fails silently

### Debugging Steps

```bash
# Check Vitest config has jsdom
grep "environment" vite.config.ts
# Should have: test: { environment: 'jsdom' }

# Run single test with debug output
cd frontend
npx vitest run --reporter=verbose src/__tests__/pages/LoginPage.test.tsx

# Check setup file is loaded
grep "setupFiles" vite.config.ts
# Should reference: src/__tests__/setup.ts
```

### Common Frontend Test Fixes

| Issue | Fix |
|-------|-----|
| `toBeInTheDocument` not recognized | Import `@testing-library/jest-dom` in setup file |
| `useNavigate` errors | Wrap component in `<BrowserRouter>` in test |
| API calls not mocked | Use `vi.mock('../../api/client', () => ...)` |
| `act()` warnings | Wrap state-changing operations in `await waitFor(() => ...)` |
| `localStorage` errors | Mock in setup file: `Object.defineProperty(window, 'localStorage', ...)` |

---

## Quick Reference: Running Tests

| Command | What It Does |
|---------|-------------|
| `cd backend && npx jest` | Run all backend tests |
| `cd backend && npx jest --testPathPattern=unit` | Unit tests only |
| `cd backend && npx jest --testPathPattern=integration` | Integration tests only |
| `cd backend && npx jest --coverage` | All tests + coverage report |
| `cd backend && npx jest --testPathPattern=energy --verbose` | Single file, verbose |
| `cd backend && npx jest -t "should return 401"` | Tests matching name pattern |
| `cd backend && npx jest --watch` | Watch mode (re-run on change) |
| `cd backend && npx jest --bail` | Stop on first failure |
| `cd backend && npx jest --detectOpenHandles --forceExit` | Debug hung tests |
| `cd frontend && npx vitest run` | Run all frontend tests |
| `cd frontend && npx vitest run --coverage` | Frontend tests + coverage |

---

## Common Issues Table

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module` | Wrong import path depth | `unit/` = `../../../`, `integration/` = `../../` |
| Tests pass alone, fail in suite | Queued mock values leak | Use `mockReset()` in `beforeEach` |
| `received undefined` | Wrong Prisma method mocked | Check source: `findUnique` vs `findUniqueOrThrow` |
| 401 in integration test | JWT secret mismatch | Set `process.env.JWT_SECRET` before importing `app` |
| 400 in integration test | Payload doesn't match Zod schema | Compare with `*.schema.ts` |
| Coverage below 90% | Untested error/edge paths | Check `coverage/lcov-report/` for uncovered lines |
| Tests hang | Open handle (server/timer) | `--detectOpenHandles --forceExit` |
| `jest.config.js` warning | Config key typo | `setupFiles` not `setupFilesAfterSetup` |
| `SyntaxError: Unexpected token` | Missing `ts-jest` preset | Ensure `preset: 'ts-jest'` in config |
| `document is not defined` | Wrong test environment | Frontend needs `environment: 'jsdom'` in Vitest config |
