#!/usr/bin/env bash
#
# Tidetime installer — one command, nothing to install first.
#
# On a fresh server this installs everything it needs (Docker, git, openssl),
# adds swap on low-memory hosts, opens the firewall, then downloads Tidetime,
# generates secrets, starts the stack, and waits until it is healthy. It uses
# the prebuilt image from the GitHub Container Registry and only builds from
# source if a pull is not possible.
#
# Usage (as root, or a user with sudo):
#   curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/Tidetime/main/install.sh | bash
#
# Environment overrides:
#   APP_URL      Public URL of the instance (default: http://<detected-public-ip>)
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

# ---- Privilege -------------------------------------------------------------
# Installing packages, Docker, swap and firewall rules needs root. Use sudo
# when not already root.
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  die "Run this as root, or install sudo first."
fi

# ---- Package helpers -------------------------------------------------------
install_pkgs() {
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -qq && $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y -q "$@"
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y -q "$@"
  elif command -v apk >/dev/null 2>&1; then
    $SUDO apk add --no-cache "$@"
  elif command -v pacman >/dev/null 2>&1; then
    $SUDO pacman -Sy --noconfirm "$@"
  else
    return 1
  fi
}

# ---- Base tools: git, openssl, curl ----------------------------------------
need=""
for tool in git openssl curl; do
  command -v "$tool" >/dev/null 2>&1 || need="${need} ${tool}"
done
if [ -n "${need}" ]; then
  info "Installing base tools:${need}"
  install_pkgs ${need} >/dev/null 2>&1 || die "Could not install:${need}. Install them and re-run."
  ok "Base tools ready"
fi

# ---- Docker + Compose plugin -----------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  info "Installing Docker…"
  curl -fsSL https://get.docker.com | $SUDO sh >/dev/null 2>&1 || die "Docker install failed. See https://docs.docker.com/get-docker/"
  $SUDO systemctl enable --now docker >/dev/null 2>&1 || $SUDO service docker start >/dev/null 2>&1 || true
  ok "Docker installed"
fi
$SUDO docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin is missing. Install docker-compose-plugin and re-run."

# ---- Swap on low-memory hosts ----------------------------------------------
mem_kb="$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
if [ "${mem_kb:-0}" -lt 2000000 ] && ! swapon --show 2>/dev/null | grep -q .; then
  info "Low memory (~$(( mem_kb / 1024 )) MB) — adding a 2G swap file"
  if $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none 2>/dev/null; then
    $SUDO chmod 600 /swapfile
    $SUDO mkswap /swapfile >/dev/null 2>&1
    $SUDO swapon /swapfile 2>/dev/null || true
    grep -q '/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
    ok "Swap enabled"
  fi
fi

# ---- Firewall: open 80/443 if a firewall is active -------------------------
if command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
  $SUDO ufw allow 80/tcp  >/dev/null 2>&1 || true
  $SUDO ufw allow 443/tcp >/dev/null 2>&1 || true
  ok "Opened firewall ports 80/443 (ufw)"
elif command -v firewall-cmd >/dev/null 2>&1 && $SUDO firewall-cmd --state 2>/dev/null | grep -q running; then
  $SUDO firewall-cmd --permanent --add-service=http  >/dev/null 2>&1 || true
  $SUDO firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
  $SUDO firewall-cmd --reload >/dev/null 2>&1 || true
  ok "Opened firewall ports 80/443 (firewalld)"
fi

secret()        { openssl rand -base64 32 | tr -d '\n'; }
secret_alnum()  { openssl rand -hex 24 | tr -d '\n'; }
public_ip() {
  curl -fsS --max-time 6 https://api.ipify.org 2>/dev/null \
    || curl -fsS --max-time 6 https://ifconfig.me 2>/dev/null \
    || curl -fsS --max-time 6 https://icanhazip.com 2>/dev/null
}

# ---- Download the project --------------------------------------------------
if [ -d "${INSTALL_DIR}/.git" ]; then
  info "Updating existing checkout in ./${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" fetch --depth 1 origin "${REF}"
  git -C "${INSTALL_DIR}" checkout -q "${REF}"
  git -C "${INSTALL_DIR}" reset -q --hard "origin/${REF}" 2>/dev/null || true
else
  info "Downloading Tidetime into ./${INSTALL_DIR}"
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
    ip="$(public_ip | tr -d '[:space:]' || true)"
    default_url="http://${ip}"
    [ -z "${ip}" ] && default_url="http://localhost"
    if [ -t 0 ]; then
      printf 'Public URL for this instance [%s]: ' "${default_url}"
      read -r app_url || true
    fi
    app_url="${app_url:-${default_url}}"
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
compose() { $SUDO docker compose -f docker-compose.prod.yml "$@"; }

info "Fetching the prebuilt image (builds from source only if unavailable)"
compose pull 2>/dev/null || info "No prebuilt image, Docker will build from source"

# `up` uses the pulled image when present and builds from the cloned source
# otherwise, so this covers both paths.
compose up -d

# ---- Wait until healthy ----------------------------------------------------
app_url="$(grep '^APP_URL=' .env | cut -d= -f2-)"
info "Waiting for Tidetime to become healthy…"
healthy=0
for _ in $(seq 1 40); do
  if curl -fsS --max-time 3 http://localhost/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    healthy=1
    break
  fi
  sleep 3
done

echo
if [ "${healthy}" -eq 1 ]; then
  ok "Tidetime is live at ${app_url}"
  echo
  echo "  Finish setup at ${app_url}/setup"
else
  info "Containers are up but health hasn't passed yet — give it a moment, then:"
  echo "    curl ${app_url}/api/health"
fi
echo "  Manage the stack from: $(pwd)"
echo "    docker compose -f docker-compose.prod.yml ps"
echo "    docker compose -f docker-compose.prod.yml logs -f app"
echo
