#!/usr/bin/env bash
#
# Tidetime installer.
#
# Sets up a production Tidetime instance with Docker. It clones the project,
# generates secrets, writes a .env file, and starts the stack. It prefers a
# prebuilt image from the GitHub Container Registry and builds from the cloned
# source when a pull is not possible.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/Tidetime/main/install.sh | bash
#
# Environment overrides:
#   APP_URL      Public URL of the instance (prompted if unset and interactive)
#   INSTALL_DIR  Where to install (default: ./tidetime)
#   TIDETIME_REF Branch or tag to install (default: main)

set -euo pipefail

REPO_URL="https://github.com/Sulaiman-Dauda/Tidetime.git"
REF="${TIDETIME_REF:-main}"
# The prebuilt image is tagged "latest" on the main branch; a version ref (e.g.
# v1.2.0) maps to its own image tag.
IMAGE_TAG="latest"
[ "${REF}" != "main" ] && IMAGE_TAG="${REF}"
IMAGE="ghcr.io/sulaiman-dauda/tidetime:${IMAGE_TAG}"
INSTALL_DIR="${INSTALL_DIR:-tidetime}"

info()  { printf '\033[0;36m•\033[0m %s\n' "$1"; }
ok()    { printf '\033[0;32m✓\033[0m %s\n' "$1"; }
die()   { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# ---- Prerequisites ---------------------------------------------------------

command -v git >/dev/null 2>&1 || die "git is required. Install it and re-run."
command -v docker >/dev/null 2>&1 || die "Docker is required. Install it from https://docs.docker.com/get-docker/ and re-run."
docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin is required (docker compose)."
command -v openssl >/dev/null 2>&1 || die "openssl is required to generate secrets."

secret()  { openssl rand -base64 32 | tr -d '\n'; }
secret_alnum() { openssl rand -hex 24 | tr -d '\n'; }

# ---- Project ---------------------------------------------------------------

if [ -d "${INSTALL_DIR}/.git" ]; then
  info "Updating existing checkout in ./${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" fetch --depth 1 origin "${REF}"
  git -C "${INSTALL_DIR}" checkout -q "${REF}"
  git -C "${INSTALL_DIR}" reset -q --hard "origin/${REF}" 2>/dev/null || true
else
  info "Cloning Tidetime into ./${INSTALL_DIR}"
  git clone --depth 1 --branch "${REF}" "${REPO_URL}" "${INSTALL_DIR}"
fi
cd "${INSTALL_DIR}"
ok "Project ready"

# ---- Environment -----------------------------------------------------------

if [ -f .env ]; then
  ok "Keeping existing .env"
else
  app_url="${APP_URL:-}"
  if [ -z "${app_url}" ]; then
    if [ -t 0 ]; then
      printf 'Public URL for this instance [http://localhost:3000]: '
      read -r app_url || true
    fi
    app_url="${app_url:-http://localhost:3000}"
  fi

  info "Generating secrets and writing .env"
  # DATABASE_URL must share the generated POSTGRES_PASSWORD, so derive both from
  # one alphanumeric (URL-safe) value.
  db_pass="$(secret_alnum)"
  cat > .env <<ENV
NODE_ENV=production
APP_URL=${app_url}
APP_NAME=Tidetime
POSTGRES_USER=postgres
POSTGRES_DB=tidetime
POSTGRES_PASSWORD=${db_pass}
DATABASE_URL=postgres://postgres:${db_pass}@postgres:5432/tidetime
AUTH_SECRET=$(secret)
CRON_SECRET=$(secret)
TIDETIME_IMAGE=${IMAGE}
ENV
  chmod 600 .env
  ok "Wrote .env (keep this file private)"
fi

# ---- Start -----------------------------------------------------------------

compose() { docker compose -f docker-compose.prod.yml "$@"; }

info "Fetching the prebuilt image (will build from source if unavailable)"
compose pull 2>/dev/null || info "No prebuilt image, Docker will build from source"

# `up` uses the pulled image when present and builds from the cloned source
# otherwise, so this covers both paths.
compose up -d

app_url="$(grep '^APP_URL=' .env | cut -d= -f2-)"
echo
ok "Tidetime is starting"
echo
echo "  Finish setup at: ${app_url}/setup"
echo "  Manage the stack from: $(pwd)"
echo "    docker compose -f docker-compose.prod.yml ps"
echo "    docker compose -f docker-compose.prod.yml logs -f app"
echo
