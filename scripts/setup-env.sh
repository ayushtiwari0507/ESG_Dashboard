#!/usr/bin/env bash
# ============================================================
# ESG Platform — Environment Setup Script
# Generates a .env file with secure random secrets.
# Usage: ./scripts/setup-env.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  echo "⚠️  .env file already exists at $ENV_FILE"
  read -rp "Overwrite? (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo "🔐 Generating secure secrets..."

DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)

# Prompt for admin credentials
read -rp "Admin email [admin@esg.local]: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@esg.local}"

read -rp "Admin full name [System Administrator]: " ADMIN_NAME
ADMIN_NAME="${ADMIN_NAME:-System Administrator}"

while true; do
  read -rsp "Admin password (min 8 chars): " ADMIN_PASSWORD
  echo
  if [[ ${#ADMIN_PASSWORD} -ge 8 ]]; then
    break
  fi
  echo "❌ Password must be at least 8 characters."
done

POSTGRES_DB="esg_platform"
POSTGRES_USER="esg_admin"

cat > "$ENV_FILE" <<EOF
# ============================================================
# ESG Platform — Environment Configuration
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT commit this file to version control.
# ============================================================

# ── Database ──
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
DB_PASSWORD=${DB_PASSWORD}

# ── Backend ──
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
PORT=4000
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://${POSTGRES_USER}:${DB_PASSWORD}@db:5432/${POSTGRES_DB}

# ── Seed Admin Account ──
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=${ADMIN_NAME}
EOF

chmod 600 "$ENV_FILE"

echo ""
echo "✅ .env file created at $ENV_FILE"
echo ""
echo "   Database password: (randomly generated)"
echo "   JWT secret:        (randomly generated)"
echo "   Admin email:       $ADMIN_EMAIL"
echo ""
echo "🚀 You can now run: docker compose up --build -d"
