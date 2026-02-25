#!/usr/bin/env bash
# ============================================================
# ESG Platform — Cleanup Script
# Handles Docker instance cleanup, build artifact cleanup,
# and temporary file cleanup.
#
# Usage:
#   ./scripts/cleanup.sh              # Interactive mode
#   ./scripts/cleanup.sh --all        # Full cleanup (destructive)
#   ./scripts/cleanup.sh --docker     # Docker-only cleanup
#   ./scripts/cleanup.sh --build      # Build artifacts only
#   ./scripts/cleanup.sh --logs       # Log files only
#   ./scripts/cleanup.sh --test       # Test/coverage artifacts only
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}✔ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✖ $1${NC}"; }

# ── Docker Cleanup ──
cleanup_docker() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Docker Cleanup"
  echo "═══════════════════════════════════════"

  if ! command -v docker &> /dev/null; then
    warn "Docker not found — skipping Docker cleanup."
    return 0
  fi

  # Stop and remove project containers
  echo "Stopping project containers..."
  cd "$PROJECT_ROOT"
  if docker compose ps -q 2>/dev/null | grep -q .; then
    docker compose down --remove-orphans 2>/dev/null && info "Containers stopped and removed." || warn "Some containers may not have stopped cleanly."
  else
    info "No running project containers found."
  fi

  # Remove project images
  echo "Removing project images..."
  local images
  images=$(docker images --filter "reference=*esg*" -q 2>/dev/null || true)
  if [[ -n "$images" ]]; then
    echo "$images" | xargs docker rmi -f 2>/dev/null && info "Project images removed." || warn "Some images could not be removed."
  else
    info "No project images found."
  fi

  # Remove dangling images
  local dangling
  dangling=$(docker images -f "dangling=true" -q 2>/dev/null || true)
  if [[ -n "$dangling" ]]; then
    echo "$dangling" | xargs docker rmi -f 2>/dev/null && info "Dangling images removed." || warn "Some dangling images could not be removed."
  else
    info "No dangling images found."
  fi

  # Remove build cache
  echo "Pruning Docker build cache..."
  docker builder prune -f 2>/dev/null && info "Build cache pruned." || warn "Build cache prune failed."

  # Show disk usage
  echo ""
  echo "Docker disk usage after cleanup:"
  docker system df 2>/dev/null || true
}

# ── Docker Volume Cleanup (destructive — removes DB data) ──
cleanup_docker_volumes() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Docker Volume Cleanup (DESTRUCTIVE)"
  echo "═══════════════════════════════════════"

  if ! command -v docker &> /dev/null; then
    warn "Docker not found — skipping."
    return 0
  fi

  cd "$PROJECT_ROOT"
  # Remove volumes associated with compose project
  docker compose down -v 2>/dev/null && info "Containers and volumes removed." || warn "Cleanup may be partial."

  # Remove any orphaned volumes
  local orphaned
  orphaned=$(docker volume ls -qf dangling=true 2>/dev/null || true)
  if [[ -n "$orphaned" ]]; then
    echo "$orphaned" | xargs docker volume rm 2>/dev/null && info "Orphaned volumes removed." || warn "Some orphaned volumes could not be removed."
  else
    info "No orphaned volumes found."
  fi
}

# ── Build Artifact Cleanup ──
cleanup_build() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Build Artifact Cleanup"
  echo "═══════════════════════════════════════"

  # Backend dist
  if [[ -d "$PROJECT_ROOT/backend/dist" ]]; then
    rm -rf "$PROJECT_ROOT/backend/dist"
    info "Removed backend/dist/"
  else
    info "backend/dist/ not found — already clean."
  fi

  # Frontend dist
  if [[ -d "$PROJECT_ROOT/frontend/dist" ]]; then
    rm -rf "$PROJECT_ROOT/frontend/dist"
    info "Removed frontend/dist/"
  else
    info "frontend/dist/ not found — already clean."
  fi

  # node_modules
  if [[ -d "$PROJECT_ROOT/backend/node_modules" ]]; then
    rm -rf "$PROJECT_ROOT/backend/node_modules"
    info "Removed backend/node_modules/"
  else
    info "backend/node_modules/ not found — already clean."
  fi

  if [[ -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
    rm -rf "$PROJECT_ROOT/frontend/node_modules"
    info "Removed frontend/node_modules/"
  else
    info "frontend/node_modules/ not found — already clean."
  fi

  # Root node_modules (if any)
  if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
    rm -rf "$PROJECT_ROOT/node_modules"
    info "Removed root node_modules/"
  fi

  # Prisma generated client
  if [[ -d "$PROJECT_ROOT/backend/node_modules/.prisma" ]]; then
    rm -rf "$PROJECT_ROOT/backend/node_modules/.prisma"
    info "Removed generated Prisma client."
  fi
}

# ── Log Cleanup ──
cleanup_logs() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Log File Cleanup"
  echo "═══════════════════════════════════════"

  if [[ -d "$PROJECT_ROOT/backend/logs" ]]; then
    rm -f "$PROJECT_ROOT/backend/logs/"*.log
    info "Cleared backend/logs/*.log"
  else
    info "backend/logs/ not found — already clean."
  fi
}

# ── Test / Coverage Artifact Cleanup ──
cleanup_test() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Test & Coverage Artifact Cleanup"
  echo "═══════════════════════════════════════"

  # Backend coverage
  if [[ -d "$PROJECT_ROOT/backend/coverage" ]]; then
    rm -rf "$PROJECT_ROOT/backend/coverage"
    info "Removed backend/coverage/"
  else
    info "backend/coverage/ not found — already clean."
  fi

  # Frontend coverage
  if [[ -d "$PROJECT_ROOT/frontend/coverage" ]]; then
    rm -rf "$PROJECT_ROOT/frontend/coverage"
    info "Removed frontend/coverage/"
  else
    info "frontend/coverage/ not found — already clean."
  fi
}

# ── Full Cleanup ──
cleanup_all() {
  cleanup_docker
  cleanup_docker_volumes
  cleanup_build
  cleanup_logs
  cleanup_test
  echo ""
  info "Full cleanup complete."
}

# ── Interactive Mode ──
interactive() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  ESG Platform — Cleanup Wizard"
  echo "═══════════════════════════════════════"
  echo ""
  echo "Select cleanup scope:"
  echo "  1) Docker only (containers, images, build cache)"
  echo "  2) Docker + volumes (DESTRUCTIVE — deletes DB data)"
  echo "  3) Build artifacts (dist/, node_modules/)"
  echo "  4) Log files (backend/logs/)"
  echo "  5) Test/coverage artifacts"
  echo "  6) All of the above (FULL RESET)"
  echo "  0) Cancel"
  echo ""
  read -rp "Choice [0-6]: " choice

  case "$choice" in
    1) cleanup_docker ;;
    2) cleanup_docker; cleanup_docker_volumes ;;
    3) cleanup_build ;;
    4) cleanup_logs ;;
    5) cleanup_test ;;
    6)
      echo ""
      warn "This will remove ALL Docker data, build artifacts, logs, and coverage."
      read -rp "Are you sure? (y/N): " confirm
      if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        cleanup_all
      else
        echo "Aborted."
        exit 0
      fi
      ;;
    0) echo "Cancelled."; exit 0 ;;
    *) error "Invalid choice."; exit 1 ;;
  esac
}

# ── Main ──
case "${1:-}" in
  --all)     cleanup_all ;;
  --docker)  cleanup_docker ;;
  --build)   cleanup_build ;;
  --logs)    cleanup_logs ;;
  --test)    cleanup_test ;;
  --volumes) cleanup_docker_volumes ;;
  --help|-h)
    echo "Usage: $0 [--all|--docker|--build|--logs|--test|--volumes|--help]"
    echo ""
    echo "  --all       Full cleanup (Docker + build + logs + tests) — DESTRUCTIVE"
    echo "  --docker    Stop containers, remove images, prune build cache"
    echo "  --volumes   Remove Docker volumes (deletes DB data)"
    echo "  --build     Remove dist/, node_modules/"
    echo "  --logs      Clear log files"
    echo "  --test      Remove coverage/ directories"
    echo "  --help      Show this help"
    echo ""
    echo "Run without arguments for interactive mode."
    ;;
  "")        interactive ;;
  *)         error "Unknown option: $1"; echo "Run $0 --help for usage."; exit 1 ;;
esac
