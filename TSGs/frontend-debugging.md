# Frontend Debugging Guide

## Technology Context

| Component | Technology | Why |
|-----------|-----------|-----|
| UI Framework | **React 18** | Component-based architecture for data-heavy dashboards. Concurrent features (Suspense) for responsive UIs. Largest ecosystem for charting libraries. |
| Build Tool | **Vite 6.x** | Instant dev server startup (< 300ms via native ESM). Hot module replacement updates the page without losing state. Production builds use Rollup for optimal bundling. |
| Styling | **Tailwind CSS 3.x** | Utility-first CSS eliminates separate stylesheet maintenance. Tree-shaking removes unused utilities — production CSS < 10 KB. |
| Charts | **Apache ECharts 5.x** | Handles large datasets (thousands of monthly records) with built-in performance. Rich interactivity (tooltips, zoom, brush select) essential for ESG trend analysis. |
| HTTP Client | **Axios 1.x** | Request/response interceptors for automatic JWT token injection and 401 handling. All API calls go through a single `api/client.ts` instance. |
| Router | **React Router 7.x** | Client-side routing for SPA. In production, Nginx `try_files` ensures all routes fall back to `index.html`. |
| Testing | **Vitest 4.x + Testing Library** | Vitest shares Vite's config/plugins (no duplicate setup). Testing Library encourages accessible, user-centric tests. See [TESTING.md](../Docs/TESTING.md). |

> **API Proxy**: In development, Vite proxies `/api/*` to `http://localhost:4000`. In production, Nginx handles this. If API calls fail, check which proxy is active based on your environment.

> **State Management**: The app uses React Context (`AuthContext`) for auth state and local component state for data. No Redux or Zustand — the data flow is simple enough that Context + `useState` covers all cases.

## Quick Diagnostic Checklist

- [ ] Is the frontend container running? → `docker compose ps frontend`
- [ ] Does the page load in browser? → Open `http://localhost:3000`
- [ ] Are there console errors? → Open DevTools → Console tab
- [ ] Is the API reachable? → Network tab → check `/api/health`

## Debugging Steps

### 1. Check Service Status

```bash
docker compose ps frontend
docker compose logs frontend --tail 50
```

### 2. Browser DevTools

| Tab | Use For |
|---|---|
| Console | JS errors, React warnings, unhandled rejections |
| Network | API call status codes, request/response inspection |
| Application → Local Storage | Check `accessToken` is stored after login |
| Performance | Page load timing, rendering bottlenecks |

### 3. Login Not Working

```
Symptom: Form submits, shows "Login failed"
```

1. Open **Network tab** before clicking Sign In
2. Find the `POST /api/auth/login` request
3. Check:
   - **Status 401**: Wrong credentials — verify email/password
   - **Status 429**: Rate limited — wait 15 minutes
   - **Status 500**: Backend error — check backend logs
   - **Network error**: Backend unreachable — check `docker compose ps`

### 4. API Calls Failing After Login

```
Symptom: Authenticated requests return 401
```

1. Check **Local Storage** → `accessToken` exists
2. Decode token at [jwt.io](https://jwt.io) → check `exp` (expiry timestamp)
3. If expired: log out and log in again
4. If missing: the login response didn't include a token — check backend

### 5. Blank Page / White Screen

1. Open DevTools Console — look for red errors
2. Common causes:
   - **Import error**: Missing dependency → `npm install` in frontend
   - **Build error**: Check `docker compose logs frontend`
   - **React error**: Check for ErrorBoundary fallback UI

### 6. Nginx Proxy Issues (Production)

The frontend container uses nginx to:
- Serve the React SPA (all routes → `index.html`)
- Proxy `/api/*` requests to the backend

```bash
# Check nginx config
docker compose exec frontend cat /etc/nginx/conf.d/default.conf

# Test proxy from inside frontend container
docker compose exec frontend wget -qO- http://backend:4000/api/health
```

### 7. Development Mode Debugging

```bash
# Run frontend locally (outside Docker)
cd frontend
npm install
npm run dev

# Vite dev server starts at http://localhost:3000
# API calls proxy to http://localhost:4000 (configure in vite.config.ts)
```

### 8. React State Debugging

Install [React DevTools](https://react.dev/learn/react-developer-tools) browser extension:

- **Components tab**: Inspect component tree, props, state
- **Profiler tab**: Measure render performance
- Check `AuthContext` provider state for user/token/loading

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| White screen | JS crash before render | Check Console for error, ErrorBoundary should catch |
| "Network Error" on API calls | Backend not running or CORS | Check `docker compose ps`, verify CORS config |
| Redirect loop to `/login` | Token expired or invalid | Clear Local Storage, re-login |
| Styles not loading | Tailwind purge or PostCSS issue | Check `tailwind.config.js` content paths |
| Charts not rendering | ECharts error | Check data format matches chart config |
| "Module not found" | Missing npm package | `npm install` then rebuild |
