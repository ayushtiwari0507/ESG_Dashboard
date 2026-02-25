# Docker Debugging Guide

## Technology Context

| Component | Technology | Why |
|-----------|-----------|-----|
| Container runtime | **Docker + Docker Compose** | Single-command deployment (`docker compose up -d`). Three services (frontend, backend, db) defined declaratively. No orchestration overhead (Kubernetes not needed for single-server ESG deployments). |
| Frontend container | **Nginx (alpine)** | Serves React static build + reverse proxies `/api/*` to backend. Nginx handles SPA routing (`try_files $uri /index.html`) so React Router works for all paths. |
| Backend container | **Node.js 20 (alpine)** | Multi-stage Dockerfile: build stage compiles TypeScript, production stage runs only compiled JS + runtime deps. Smaller image, no dev tools in production. |
| Database container | **PostgreSQL 16 (alpine)** | Health check via `pg_isready` — backend waits for DB to be healthy before starting (`depends_on: condition: service_healthy`). |
| Networking | **Docker Compose default network** | All 3 services share a network. Services reference each other by container name (`db`, `backend`). No port exposure needed for inter-service communication. |
| Log rotation | **JSON driver, 10 MB, 5 files** | Configured per-service in `docker-compose.yml` to prevent disk exhaustion. Docker's default logging has no size limits. |

> **Architecture**: `Browser → Nginx (port 3000)` — Nginx serves React static files for `/*` and proxies `/api/*` to Express on port 4000. Express connects to PostgreSQL on port 5432. All internal communication uses Docker DNS (service names, not IP addresses).

## Quick Diagnostic Checklist

- [ ] Docker daemon running? → `docker info`
- [ ] All containers up? → `docker compose ps`
- [ ] Any restart loops? → `docker compose ps` (check STATUS for "Restarting")
- [ ] Network connectivity? → `docker compose exec backend ping db`

## Debugging Steps

### 1. Container Status

```bash
# Show all containers with status
docker compose ps

# Expected output:
# NAME        SERVICE    STATUS              PORTS
# esg-db      db         Up (healthy)        5432
# esg-backend backend    Up                  4000
# esg-frontend frontend  Up                  3000

# Check all Docker containers (including stopped)
docker ps -a --filter "label=com.docker.compose.project"
```

### 2. Logs

```bash
# All services
docker compose logs

# Specific service, follow mode
docker compose logs -f backend

# Last 200 lines of all services with timestamps
docker compose logs --tail 200 --timestamps

# Just errors (grep for common patterns)
docker compose logs 2>&1 | grep -iE "error|fatal|panic|exception"
```

### 3. Container Inspection

```bash
# Enter a running container
docker compose exec backend sh
docker compose exec db bash

# Check environment variables
docker compose exec backend printenv | sort

# Check resource usage
docker stats --no-stream

# Inspect container details
docker inspect $(docker compose ps -q backend)
```

### 4. Network Issues

```bash
# List Docker networks
docker network ls

# Test inter-container connectivity
docker compose exec backend ping -c 3 db
docker compose exec frontend wget -qO- http://backend:4000/api/health

# Check DNS resolution
docker compose exec backend nslookup db
```

### 5. Volume Issues

```bash
# List volumes
docker volume ls

# Inspect DB volume
docker volume inspect esgwebapp_pgdata

# Check disk usage
docker system df
```

### 6. Build Issues

```bash
# Rebuild without cache
docker compose build --no-cache

# Rebuild specific service
docker compose build --no-cache backend

# Check Dockerfile steps
docker compose build backend 2>&1 | tail -30
```

### 7. Restart & Cleanup

```bash
# Restart all services
docker compose restart

# Restart single service
docker compose restart backend

# Full stop + start (preserves volumes)
docker compose down && docker compose up -d

# Nuclear option: remove everything (DESTRUCTIVE)
docker compose down -v --rmi all
docker compose up -d --build

# ── Automated Cleanup (recommended) ──
# Interactive cleanup wizard
./scripts/cleanup.sh

# Docker only (containers, images, build cache)
./scripts/cleanup.sh --docker

# Docker + volumes (DESTRUCTIVE — deletes DB data)
./scripts/cleanup.sh --docker && ./scripts/cleanup.sh --volumes

# Full cleanup (Docker + build artifacts + logs + test artifacts)
./scripts/cleanup.sh --all
```

### 8. Resource Limits

```bash
# Check memory/CPU usage per container
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# If OOM killed, check:
docker inspect $(docker compose ps -q backend) | grep -A5 OOMKilled
```

### 9. Log Rotation

All services are configured with JSON log driver rotation:
- **Max size**: 10 MB per log file
- **Max files**: 5 rotated files

```bash
# Check log file size
ls -lh /var/lib/docker/containers/*/  # requires root

# Verify log config
docker inspect $(docker compose ps -q backend) --format '{{.HostConfig.LogConfig}}'
```

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Container exits immediately | Missing env vars or crash | `docker compose logs <service>` |
| `port is already allocated` | Port conflict | Stop other service on that port or change mapping |
| Build fails at npm install | Network issue or lockfile | `docker compose build --no-cache` |
| DB not ready when backend starts | Race condition | Already handled via `depends_on: condition: service_healthy` |
| Frontend shows 502 Bad Gateway | Backend not reachable from nginx | Check `backend` service is running and nginx upstream config |
| Disk full | Docker images/volumes | `docker system prune -a --volumes` (careful!) |
| Changes not reflected | Build cache | `docker compose build --no-cache <service>` |
