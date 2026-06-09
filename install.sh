#!/usr/bin/env bash
#
# Tidetime one-command installer.
#
#   curl -fsSL https://install.tidetime.com -o install.sh && chmod +x install.sh && ./install.sh
#
# For now (no domain yet), use the GitHub source directly:
#
#   curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/tidetime/main/install.sh -o install.sh
#   chmod +x install.sh
#   ./install.sh
#
# What it does, end to end, without you ever editing a .env file:
#   1. Checks for Docker (and offers to install it on Linux).
#   2. Fetches the Tidetime source from GitHub (or uses the local checkout).
#   3. Generates a hardened .env: random DB password + 64-char AUTH_SECRET + CRON_SECRET.
#   4. Builds and launches Postgres + the app + the reminders worker via Docker Compose.
#   5. Runs database migrations automatically and waits until the app is healthy.
#
# Re-running is safe: existing secrets in .env are preserved, never regenerated.
#
# Optional overrides (handy for unattended / curl|bash installs):
#   TIDETIME_DIR=/opt/tidetime     where to install
#   TIDETIME_URL=https://book.me   public URL (else http://<server-ip>:<port>)
#   TIDETIME_PORT=3000             host port to expose
#   TIDETIME_BRANCH=main           git branch to deploy
#   TIDETIME_YES=1                 assume "yes" to all prompts (non-interactive)
#
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
#  Config / constants
# ──────────────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Sulaiman-Dauda/tidetime.git"
RAW_URL="https://raw.githubusercontent.com/Sulaiman-Dauda/tidetime"
BRANCH="${TIDETIME_BRANCH:-main}"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT="tidetime"
APP_PORT="${TIDETIME_PORT:-3000}"
HEALTH_TIMEOUT=300   # seconds to wait for first healthy response

# ──────────────────────────────────────────────────────────────────────────────
#  Colours (respect NO_COLOR and non-TTY)
# ──────────────────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  BOLD="$(tput bold)"; DIM="$(tput dim)"; RESET="$(tput sgr0)"
  CYAN="$(tput setaf 6)"; BLUE="$(tput setaf 4)"; GREEN="$(tput setaf 2)"
  YELLOW="$(tput setaf 3)"; RED="$(tput setaf 1)"; WHITE="$(tput setaf 7)"
else
  BOLD=""; DIM=""; RESET=""; CYAN=""; BLUE=""; GREEN=""; YELLOW=""; RED=""; WHITE=""
fi

IS_TTY=0; [ -t 0 ] && IS_TTY=1

info()  { printf "%s  %s%s\n"  "${CYAN}›${RESET}" "$1" "${RESET}"; }
ok()    { printf "%s  %s%s\n"  "${GREEN}✔${RESET}" "$1" "${RESET}"; }
warn()  { printf "%s  %s%s\n"  "${YELLOW}!${RESET}" "$1" "${RESET}"; }
err()   { printf "%s  %s%s\n"  "${RED}✘${RESET}" "${RED}$1" "${RESET}" >&2; }
die()   { err "$1"; exit 1; }

# ──────────────────────────────────────────────────────────────────────────────
#  Ocean-wave animations
# ──────────────────────────────────────────────────────────────────────────────
WAVE_GLYPHS=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅ ▄ ▃ ▂)
WAVE_FRAMES=()
build_wave_frames() {
  local width=22 n=${#WAVE_GLYPHS[@]} shift i idx line
  for ((shift = 0; shift < n; shift++)); do
    line=""
    for ((i = 0; i < width; i++)); do
      idx=$(((i + shift) % n))
      line+="${WAVE_GLYPHS[idx]}"
    done
    WAVE_FRAMES+=("$line")
  done
}
build_wave_frames

# Run a command in the background while a wave rolls across the terminal.
# Usage: wave_run "Message" /path/to/logfile -- command args...
wave_run() {
  local msg="$1" logfile="$2"; shift 2
  [ "$1" = "--" ] && shift

  if [ "$IS_TTY" -ne 1 ]; then
    info "$msg"
    local rc=0; "$@" >"$logfile" 2>&1 || rc=$?
    return $rc
  fi

  "$@" >"$logfile" 2>&1 &
  local pid=$! f=0 nframes=${#WAVE_FRAMES[@]} start now elapsed
  start=$(date +%s)
  printf '\e[?25l'  # hide cursor
  while kill -0 "$pid" 2>/dev/null; do
    now=$(date +%s); elapsed=$((now - start))
    printf "\r  ${CYAN}%s${RESET}  %s ${DIM}(%ss)${RESET}   " "${WAVE_FRAMES[f]}" "$msg" "$elapsed"
    f=$(((f + 1) % nframes))
    sleep 0.12
  done
  printf '\e[?25h'  # show cursor
  local rc=0; wait "$pid" || rc=$?
  if [ $rc -eq 0 ]; then
    printf "\r  ${GREEN}%s${RESET}  %s ${DIM}(%ss)${RESET}        \n" "$(printf '▇%.0s' $(seq 1 22))" "$msg" "$elapsed"
  else
    printf "\r  ${RED}%s${RESET}  %s            \n" "$(printf '▁%.0s' $(seq 1 22))" "$msg"
  fi
  return $rc
}

type_line() {  # gentle typewriter for the banner subtitle
  local text="$1" i ch
  if [ "$IS_TTY" -ne 1 ]; then printf "%s\n" "$text"; return; fi
  for ((i = 0; i < ${#text}; i++)); do
    ch="${text:i:1}"; printf "%s" "$ch"; sleep 0.012
  done
  printf "\n"
}

banner() {
  printf "\n"
  printf "%s" "$BOLD$CYAN"
  cat <<'ART'
        ╭───────────────────────────────────────────────╮
        │   ~≈≋  T I D E T I M E  ≋≈~                     │
        │   ▁▂▃▄▅▆▇█  scheduling, in sync  █▇▆▅▄▃▂▁       │
        ╰───────────────────────────────────────────────╯
ART
  printf "%s" "$RESET"
  printf "        %s" "$DIM"
  type_line "Self-hosted installer · open-source · v1"
  printf "%s\n" "$RESET"
}

# ──────────────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────────────
confirm() {  # confirm "Question?"  -> 0 yes / 1 no.  Defaults to yes.
  local q="$1"
  if [ "${TIDETIME_YES:-0}" = "1" ] || [ "$IS_TTY" -ne 1 ]; then return 0; fi
  printf "  %s%s%s [Y/n] " "$BOLD" "$q" "$RESET"
  local a; read -r a || true
  case "$a" in [nN]*) return 1 ;; *) return 0 ;; esac
}

ask() {  # ask "Prompt" "default" -> echoes answer
  local q="$1" def="$2" a
  if [ "${TIDETIME_YES:-0}" = "1" ] || [ "$IS_TTY" -ne 1 ]; then echo "$def"; return; fi
  printf "  %s%s%s %s[%s]%s: " "$BOLD" "$q" "$RESET" "$DIM" "$def" "$RESET" >&2
  read -r a || true
  echo "${a:-$def}"
}

gen_secret() {  # url-safe secret, >= 48 chars
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48
  fi
}

detect_url() {  # best-effort public base URL when none supplied
  local ip=""
  ip="$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  [ -z "$ip" ] && ip="localhost"
  echo "http://${ip}:${APP_PORT}"
}

DC=""  # resolved docker compose invocation
resolve_compose() {
  if docker compose version >/dev/null 2>&1; then DC="docker compose";
  elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose";
  else return 1; fi
  return 0
}

SUDO=""
need_sudo() { [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"; }

# ──────────────────────────────────────────────────────────────────────────────
#  1. Preflight — Docker + git
# ──────────────────────────────────────────────────────────────────────────────
preflight() {
  info "Checking prerequisites…"
  command -v curl >/dev/null 2>&1 || die "curl is required. Please install it and re-run."

  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker is not installed."
    local os; os="$(uname -s)"
    if [ "$os" = "Linux" ]; then
      if confirm "Install Docker now (via get.docker.com)?"; then
        need_sudo
        wave_run "Installing Docker" /tmp/tidetime-docker.log -- bash -c "curl -fsSL https://get.docker.com | ${SUDO} sh" \
          || die "Docker installation failed. See /tmp/tidetime-docker.log"
        need_sudo
        ${SUDO} systemctl enable --now docker >/dev/null 2>&1 || true
      else
        die "Docker is required. Install it from https://docs.docker.com/engine/install/ and re-run."
      fi
    else
      die "Please install Docker Desktop (https://www.docker.com/products/docker-desktop) and re-run."
    fi
  fi
  ok "Docker is installed."

  if ! docker info >/dev/null 2>&1; then
    need_sudo
    if [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
      DOCKER_SUDO="$SUDO"
      warn "Running Docker with sudo (your user isn't in the 'docker' group yet)."
    else
      die "Docker is installed but not running. Start the Docker daemon and re-run."
    fi
  fi

  resolve_compose || die "Docker Compose v2 is required (comes with modern Docker). Update Docker and re-run."
  ok "Docker Compose detected: ${DC}"

  command -v git >/dev/null 2>&1 || die "git is required. Please install it and re-run."
}
DOCKER_SUDO=""

# ──────────────────────────────────────────────────────────────────────────────
#  2. Source — clone from GitHub or use the local checkout
# ──────────────────────────────────────────────────────────────────────────────
fetch_source() {
  # If this script sits next to the compose file, install in place.
  local script_dir; script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
  if [ -n "$script_dir" ] && [ -f "$script_dir/$COMPOSE_FILE" ]; then
    DIR="$script_dir"
    info "Using local Tidetime checkout: ${BOLD}${DIR}${RESET}"
    return
  fi

  DIR="${TIDETIME_DIR:-}"
  if [ -z "$DIR" ]; then
    if [ "$(id -u)" -eq 0 ] || { command -v sudo >/dev/null 2>&1 && [ -w /opt 2>/dev/null ]; }; then
      DIR="/opt/tidetime"
    else
      DIR="$HOME/tidetime"
    fi
    DIR="$(ask "Install directory" "$DIR")"
  fi

  if [ -d "$DIR/.git" ]; then
    info "Updating existing checkout in ${BOLD}${DIR}${RESET}"
    wave_run "Pulling latest source" /tmp/tidetime-git.log -- git -C "$DIR" pull --ff-only origin "$BRANCH" \
      || die "git pull failed. See /tmp/tidetime-git.log"
  else
    need_sudo
    if [ ! -d "$DIR" ]; then ${SUDO} mkdir -p "$DIR"; ${SUDO} chown "$(id -u):$(id -g)" "$DIR" 2>/dev/null || true; fi
    info "Fetching Tidetime into ${BOLD}${DIR}${RESET}"
    wave_run "Cloning ${REPO_URL##*/} (${BRANCH})" /tmp/tidetime-git.log -- \
      git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DIR" \
      || die "git clone failed. See /tmp/tidetime-git.log"
  fi
}

# ──────────────────────────────────────────────────────────────────────────────
#  3. Generate .env — secrets auto-created, existing ones preserved
# ──────────────────────────────────────────────────────────────────────────────
read_env_value() { grep -E "^$1=" "$DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- || true; }

write_env() {
  local env_file="$DIR/.env"

  # Public URL.
  local url="${TIDETIME_URL:-}"
  if [ -z "$url" ]; then
    local existing; existing="$(read_env_value APP_URL)"
    if [ -n "$existing" ]; then
      url="$existing"
    else
      local suggested; suggested="$(detect_url)"
      printf "\n"
      info "Tidetime needs a public URL (used for email links & OAuth redirects)."
      info "No domain yet? Just press Enter to use the detected address."
      url="$(ask "Public URL" "$suggested")"
    fi
  fi
  case "$url" in
    http://*|https://*) ;;
    *) url="https://${url}" ;;        # bare domain -> assume https
  esac
  url="${url%/}"                       # strip trailing slash

  # Preserve secrets across re-runs; mint fresh ones on first install.
  local auth_secret pg_pass cron_secret
  auth_secret="$(read_env_value AUTH_SECRET)"; [ -z "$auth_secret" ] && auth_secret="$(gen_secret)$(gen_secret)" && auth_secret="${auth_secret:0:64}"
  pg_pass="$(read_env_value POSTGRES_PASSWORD)"; [ -z "$pg_pass" ] && pg_pass="$(gen_secret)"
  cron_secret="$(read_env_value CRON_SECRET)"; [ -z "$cron_secret" ] && cron_secret="$(gen_secret)"

  info "Writing ${BOLD}${env_file}${RESET} (secrets generated automatically)…"
  umask 077
  cat >"$env_file" <<EOF
# Generated by install.sh — do not commit. Re-running the installer preserves these.
NODE_ENV=production
APP_NAME=Tidetime
APP_URL=${url}

# Host port the app is published on (container always listens on 3100).
APP_PORT=${APP_PORT}

# Session + at-rest encryption key. Rotating this invalidates sessions and makes
# previously stored integration secrets undecryptable — keep it safe.
AUTH_SECRET=${auth_secret}

# Shared secret for the HTTP job endpoint (POST /api/cron). The bundled reminders
# worker doesn't need it, but it's here if you wire an external scheduler.
CRON_SECRET=${cron_secret}

# PostgreSQL (the bundled 'postgres' service). DATABASE_URL is derived from these
# inside docker-compose; no need to set it here.
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${pg_pass}
POSTGRES_DB=tidetime
EOF
  chmod 600 "$env_file"
  APP_URL_FINAL="$url"
  ok "Configuration ready — no manual .env editing needed."
}

# ──────────────────────────────────────────────────────────────────────────────
#  4. Build + launch
# ──────────────────────────────────────────────────────────────────────────────
launch() {
  printf "\n"
  info "Building images and starting the stack. First build pulls Node + compiles the app — grab a coffee. ☕"
  # $DOCKER_SUDO and $DC are intentionally unquoted so they word-split into args
  # ("docker compose" → two tokens). wave_run execs the result directly.
  wave_run "Building & launching Tidetime" /tmp/tidetime-build.log -- \
    ${DOCKER_SUDO} $DC -p "$PROJECT" -f "$DIR/$COMPOSE_FILE" --project-directory "$DIR" up -d --build \
    || { err "Build/launch failed. Last 40 lines:"; tail -n 40 /tmp/tidetime-build.log; exit 1; }
  ok "Containers are up."
}

wait_healthy() {
  printf "\n"
  local url="http://127.0.0.1:${APP_PORT}/api/health"
  if [ "$IS_TTY" -ne 1 ]; then
    info "Waiting for the app to become healthy…"
  fi
  local start now elapsed f=0 nframes=${#WAVE_FRAMES[@]}
  start=$(date +%s)
  [ "$IS_TTY" -eq 1 ] && printf '\e[?25l'
  while true; do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      [ "$IS_TTY" -eq 1 ] && printf '\e[?25h'
      printf "\r  ${GREEN}%s${RESET}  Database connected · app healthy            \n" "$(printf '▇%.0s' $(seq 1 22))"
      return 0
    fi
    now=$(date +%s); elapsed=$((now - start))
    if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
      [ "$IS_TTY" -eq 1 ] && printf '\e[?25h'
      printf "\n"
      warn "App did not report healthy within ${HEALTH_TIMEOUT}s. It may still be migrating."
      warn "Check logs with:  ${BOLD}cd $DIR && $DC -p $PROJECT -f $COMPOSE_FILE logs -f app${RESET}"
      return 1
    fi
    if [ "$IS_TTY" -eq 1 ]; then
      printf "\r  ${CYAN}%s${RESET}  Waiting for migrations & first boot ${DIM}(%ss)${RESET}   " "${WAVE_FRAMES[f]}" "$elapsed"
      f=$(((f + 1) % nframes))
    fi
    sleep 0.5
  done
}

# ──────────────────────────────────────────────────────────────────────────────
#  5. The sign-off
# ──────────────────────────────────────────────────────────────────────────────
success() {
  printf "\n"
  printf "%s%s" "$BOLD" "$CYAN"
  cat <<'ART'
        ≈≋≈  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁  ≈≋≈
ART
  printf "%s\n" "$RESET"
  printf "        %s%sTHE TIDE IS IN.%s  🌊\n" "$BOLD" "$GREEN" "$RESET"
  printf "        %sTidetime is live — your schedule's in sync.%s\n\n" "$WHITE" "$RESET"

  printf "        %sOpen Tidetime%s   %s%s%s\n" "$DIM" "$RESET" "$BOLD$CYAN" "$APP_URL_FINAL" "$RESET"
  printf "        %sFirst run%s       %sgo to %s/setup to create your owner account%s\n" "$DIM" "$RESET" "$WHITE" "$APP_URL_FINAL" "$RESET"
  printf "        %sConfigure%s       %sSettings → Integrations / Payments (SMTP, Stripe, calendars)%s\n\n" "$DIM" "$RESET" "$WHITE" "$RESET"

  printf "        %sManage your fleet:%s\n" "$DIM" "$RESET"
  printf "          %slogs%s     cd %s && %s -f %s logs -f\n" "$BOLD" "$RESET" "$DIR" "$DC -p $PROJECT" "$COMPOSE_FILE"
  printf "          %sstop%s     cd %s && %s -f %s down\n" "$BOLD" "$RESET" "$DIR" "$DC -p $PROJECT" "$COMPOSE_FILE"
  printf "          %supdate%s   re-run this installer\n\n" "$BOLD" "$RESET"

  if [ "$APP_URL_FINAL" != "${APP_URL_FINAL#http://}" ]; then
    warn "You're on plain HTTP. When your domain is ready, point it here, set APP_URL to the https:// URL, put a reverse proxy (Caddy/Traefik/Nginx) in front, and re-run."
  fi
  printf "        %sCalm seas. ⚓%s\n\n" "$DIM" "$RESET"
}

# ──────────────────────────────────────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────────────────────────────────────
main() {
  banner
  preflight
  fetch_source
  write_env
  launch
  wait_healthy || true
  success
}

main "$@"
