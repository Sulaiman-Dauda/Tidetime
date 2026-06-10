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
#   4. Pulls the prebuilt image from GHCR (fast, works on 1GB servers) and starts
#      Postgres + the app + the reminders worker via Docker Compose. If the pull
#      fails (no registry access, unsupported architecture, a fork), it falls
#      back to building from source — adding swap first if the server is small.
#   5. Runs database migrations automatically and waits until the app is healthy.
#
# Re-running is safe: existing secrets in .env are preserved, never regenerated.
#
# Optional overrides (handy for unattended / curl|bash installs):
#   TIDETIME_DIR=/opt/tidetime     where to install
#   TIDETIME_URL=https://book.me   public URL (else http://<server-ip>:<port>)
#   TIDETIME_PORT=3000             host port to expose
#   TIDETIME_BRANCH=main           git branch to deploy
#   TIDETIME_IMAGE=ghcr.io/...     prebuilt image to pull (default: official latest)
#   TIDETIME_BUILD=1               skip the prebuilt image, build from source
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
#  The voyage engine 🌊 — a little ship sails your progress to the island.
#
#  · Real percentages where the tooling reports steps (Docker BuildKit).
#  · When no % exists, the ship explores back and forth — but you always get a
#    live "└ last log line" under the bar, so it's never a frozen black box.
#  · Non-TTY (curl | bash, CI) degrades to heartbeat lines every 30s.
# ──────────────────────────────────────────────────────────────────────────────
WAVE_GLYPHS=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅ ▄ ▃ ▂)
SEA_W=26
SHIP="⛵" ISLAND="🏝"
QUIPS=(
  "hoisting the mainsail" "charting the waters" "trimming the jib"
  "reading the stars" "feeding the gulls" "watching for whales"
  "riding the current" "steady as she goes" "plotting the course"
  "securing the cargo" "whistling for wind" "minding the boom"
)
ESC="$(printf '\033')"

last_log_line() {  # newest non-empty line of a logfile, ANSI-stripped, truncated
  local file="$1" cols max line
  cols="$(tput cols 2>/dev/null || echo 100)"
  line="$(tail -n 30 "$file" 2>/dev/null | tr '\r' '\n' \
    | sed -e "s/${ESC}\[[0-9;]*[A-Za-z]//g" \
    | grep -vE '^[[:space:]]*$' | tail -n 1 || true)"
  line="${line//$'\t'/ }"
  max=$((cols - 10)); [ "$max" -lt 24 ] && max=24
  [ "${#line}" -gt "$max" ] && line="${line:0:max}…"
  printf '%s' "$line"
}

docker_progress() {  # % of BuildKit steps completed (#N … / #N DONE), -1 = unknown
  local file="$1" total done_n pct
  total="$(grep -oE '^#[0-9]+' "$file" 2>/dev/null | sort -u | wc -l || true)"
  if [ "${total:-0}" -lt 3 ]; then echo -1; return 0; fi
  done_n="$(grep -E '^#[0-9]+ (DONE|CACHED|ERROR)' "$file" 2>/dev/null \
    | cut -d' ' -f1 | sort -u | wc -l || true)"
  pct=$((done_n * 100 / total))
  [ "$pct" -gt 99 ] && pct=99   # 100% only when the ship actually docks
  echo "$pct"
}

render_sea() {  # render_sea <pct|-1> <frame> — waves astern, calm sea ahead, island at the end
  local pct="$1" frame="$2" n=${#WAVE_GLYPHS[@]} i pos out=""
  if [ "$pct" -ge 0 ]; then
    pos=$((pct * SEA_W / 100))
    [ "$pos" -gt $((SEA_W - 1)) ] && pos=$((SEA_W - 1))
  else  # no % known: the ship explores back and forth
    pos=$((frame % (2 * (SEA_W - 1))))
    [ "$pos" -ge "$SEA_W" ] && pos=$((2 * (SEA_W - 1) - pos))
  fi
  out="$CYAN"
  for ((i = 0; i < SEA_W; i++)); do
    if [ "$i" -eq "$pos" ]; then out+="${RESET}${SHIP}${DIM}"
    elif [ "$i" -lt "$pos" ]; then out+="${WAVE_GLYPHS[$(((i + frame) % n))]}"
    else out+="·"; fi
  done
  printf '%s%s%s' "$out" "$RESET" "$ISLAND"
}

# Run a command while the ship sails. Live % (when parseable) + last log line.
# Usage: voyage_run "Message" /path/to/logfile <docker|none> -- command args...
voyage_run() {
  local msg="$1" logfile="$2" pmode="$3"; shift 3
  [ "$1" = "--" ] && shift
  : >"$logfile"

  if [ "$IS_TTY" -ne 1 ]; then  # plain heartbeat for curl|bash / CI
    info "$msg"
    "$@" >"$logfile" 2>&1 &
    local pid=$! rc=0 beat=0 lastline="" ll=""
    while kill -0 "$pid" 2>/dev/null; do
      sleep 5; beat=$((beat + 5))
      if [ $((beat % 30)) -eq 0 ]; then
        ll="$(last_log_line "$logfile")"
        if [ -n "$ll" ] && [ "$ll" != "$lastline" ]; then info "   …${beat}s · $ll"; lastline="$ll"; fi
      fi
    done
    wait "$pid" || rc=$?
    return $rc
  fi

  "$@" >"$logfile" 2>&1 &
  local pid=$! f=0 start now elapsed=0 pct=-1 lastpoll=0 quip="${QUIPS[0]}" detail="" pcttxt=""
  start=$(date +%s)
  printf '\e[?25l\n'  # hide cursor, reserve the detail line
  while kill -0 "$pid" 2>/dev/null; do
    now=$(date +%s); elapsed=$((now - start))
    if [ "$now" -gt "$lastpoll" ]; then  # heavier polling only once per second
      lastpoll=$now
      if [ "$pmode" = "docker" ]; then pct="$(docker_progress "$logfile")"; fi
      detail="$(last_log_line "$logfile")"
      quip="${QUIPS[$(((elapsed / 6) % ${#QUIPS[@]}))]}"
    fi
    pcttxt=""
    [ "$pct" -ge 0 ] && pcttxt=" · ${BOLD}${pct}%${RESET}"
    printf '\e[1A\r\e[K  %s  %s%s %s· %s · %ss%s\n' \
      "$(render_sea "$pct" "$f")" "${BOLD}${msg}${RESET}" "$pcttxt" "$DIM" "$quip" "$elapsed" "$RESET"
    printf '\r\e[K     %s└ %s%s' "$DIM" "$detail" "$RESET"
    f=$((f + 1))
    sleep 0.12
  done
  local rc=0; wait "$pid" || rc=$?
  printf '\e[1A\r\e[K'
  if [ $rc -eq 0 ]; then
    printf '  %s%s%s%s  %s · %s100%% · docked in %ss ⚓%s\n' \
      "$GREEN" "$(printf '▇%.0s' $(seq 1 "$SEA_W"))" "$RESET" "$ISLAND" \
      "${BOLD}${msg}${RESET}" "$GREEN" "$elapsed" "$RESET"
  else
    printf '  %s%s%s   %s · %sran aground after %ss%s\n' \
      "$RED" "$(printf '▁%.0s' $(seq 1 "$SEA_W"))" "$RESET" \
      "${BOLD}${msg}${RESET}" "$RED" "$elapsed" "$RESET"
  fi
  printf '\r\e[K\e[?25h'  # clear the stale detail line, show cursor
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
need_sudo() {  # must always return 0: a non-zero last command here would trip set -e
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
}

# `next build` peaks at ~4GB of memory (it OOMs with SIGABRT even at a 2GB heap
# cap). Make sure RAM + swap covers ~5GB before building; offer a swapfile
# sized to the deficit. Swap-backed builds are slow but they finish.
ensure_memory() {
  [ -r /proc/meminfo ] || return 0
  local mem_kb swap_kb total_kb target_kb=$((5 * 1024 * 1024))
  mem_kb="$(awk '/^MemTotal/ {print $2}' /proc/meminfo)"
  swap_kb="$(awk '/^SwapTotal/ {print $2}' /proc/meminfo)"
  total_kb=$((${mem_kb:-0} + ${swap_kb:-0}))
  if [ "$total_kb" -ge "$target_kb" ]; then return 0; fi

  local deficit_gb=$(((target_kb - total_kb + 1048575) / 1048576))
  [ "$deficit_gb" -lt 2 ] && deficit_gb=2
  [ "$deficit_gb" -gt 4 ] && deficit_gb=4
  local swapfile="/swapfile"
  [ -f "$swapfile" ] && swapfile="/swapfile2"   # don't touch an existing/active one

  warn "This server has $((mem_kb / 1024))MB RAM + $((swap_kb / 1024))MB swap. The build needs ~5GB and WILL run out of memory."
  if confirm "Add a ${deficit_gb}GB swapfile (${swapfile}) to keep the build afloat?"; then
    need_sudo
    ${SUDO} fallocate -l "${deficit_gb}G" "$swapfile" 2>/dev/null \
      || ${SUDO} dd if=/dev/zero of="$swapfile" bs=1M count=$((deficit_gb * 1024)) status=none
    ${SUDO} chmod 600 "$swapfile"
    ${SUDO} mkswap "$swapfile" >/dev/null
    ${SUDO} swapon "$swapfile" 2>/dev/null || true
    if ! grep -q "^${swapfile} " /etc/fstab 2>/dev/null; then
      echo "${swapfile} none swap sw 0 0" | ${SUDO} tee -a /etc/fstab >/dev/null
    fi
    ok "${deficit_gb}GB swap enabled (persists across reboots) — smoother sailing."
  else
    warn "Proceeding without swap. If the build fails with 'heap out of memory', re-run and say yes."
  fi
  return 0
}

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
        voyage_run "Installing Docker" /tmp/tidetime-docker.log none -- bash -c "curl -fsSL https://get.docker.com | ${SUDO} sh" \
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
    voyage_run "Pulling latest source" /tmp/tidetime-git.log none -- git -C "$DIR" pull --ff-only origin "$BRANCH" \
      || die "git pull failed. See /tmp/tidetime-git.log"
  else
    need_sudo
    if [ ! -d "$DIR" ]; then ${SUDO} mkdir -p "$DIR"; ${SUDO} chown "$(id -u):$(id -g)" "$DIR" 2>/dev/null || true; fi
    info "Fetching Tidetime into ${BOLD}${DIR}${RESET}"
    voyage_run "Cloning ${REPO_URL##*/} (${BRANCH})" /tmp/tidetime-git.log none -- \
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
# $DOCKER_SUDO and $DC are intentionally unquoted so they word-split into args
# ("docker compose" → two tokens).
dc() { ${DOCKER_SUDO} $DC -p "$PROJECT" -f "$DIR/$COMPOSE_FILE" --project-directory "$DIR" "$@"; }

build_from_source() {
  ensure_memory
  info "Compiling the app on this server — grab a coffee. ☕"
  voyage_run "Building & launching Tidetime" /tmp/tidetime-build.log docker -- \
    dc up -d --build \
    || { err "Build/launch failed. Last 40 lines:"; tail -n 40 /tmp/tidetime-build.log; exit 1; }
}

launch() {
  printf "\n"
  if [ "${TIDETIME_BUILD:-0}" = "1" ]; then
    info "TIDETIME_BUILD=1 — building from source instead of pulling the prebuilt image."
    build_from_source
  else
    info "Pulling the prebuilt Tidetime image — nothing gets compiled on this server."
    if voyage_run "Pulling prebuilt images" /tmp/tidetime-pull.log none -- dc pull; then
      voyage_run "Starting the stack" /tmp/tidetime-up.log none -- dc up -d --no-build \
        || { err "Startup failed. Last 40 lines:"; tail -n 40 /tmp/tidetime-up.log; exit 1; }
    else
      warn "Couldn't pull the prebuilt image (registry unreachable, or no image for this architecture yet)."
      info "No problem — falling back to building from source."
      build_from_source
    fi
  fi
  ok "Containers are up."
}

wait_healthy() {
  printf "\n"
  local url="http://127.0.0.1:${APP_PORT}/api/health"
  if [ "$IS_TTY" -ne 1 ]; then
    info "Waiting for the app to become healthy…"
  fi
  local start now elapsed=0 f=0 pct=0
  start=$(date +%s)
  [ "$IS_TTY" -eq 1 ] && printf '\e[?25l'
  while true; do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      [ "$IS_TTY" -eq 1 ] && printf '\e[?25h'
      printf "\r\e[K  ${GREEN}%s${RESET}${ISLAND}  ${BOLD}Database connected · app healthy${RESET} ${GREEN}⚓${RESET}\n" \
        "$(printf '▇%.0s' $(seq 1 "$SEA_W"))"
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
      pct=$((elapsed * 100 / HEALTH_TIMEOUT)); [ "$pct" -gt 99 ] && pct=99
      printf "\r\e[K  %s  ${BOLD}Migrations & first boot${RESET} ${DIM}· %ss of up to %ss${RESET}" \
        "$(render_sea "$pct" "$f")" "$elapsed" "$HEALTH_TIMEOUT"
      f=$((f + 1))
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
  local total=$(( $(date +%s) - INSTALL_START ))
  printf "        %s%sTHE TIDE IS IN.%s  🌊\n" "$BOLD" "$GREEN" "$RESET"
  printf "        %sTidetime is live — zero to scheduled in %dm %02ds.%s\n\n" "$WHITE" "$((total / 60))" "$((total % 60))" "$RESET"

  printf "        %sOpen Tidetime%s   %s%s%s\n" "$DIM" "$RESET" "$BOLD$CYAN" "$APP_URL_FINAL" "$RESET"
  printf "        %sFirst run%s       %sgo to %s/setup to create your owner account%s\n" "$DIM" "$RESET" "$WHITE" "$APP_URL_FINAL" "$RESET"
  printf "        %sConfigure%s       %sSettings → Integrations / Payments (SMTP, Stripe, calendars)%s\n\n" "$DIM" "$RESET" "$WHITE" "$RESET"

  printf "        %sManage your fleet:%s\n" "$DIM" "$RESET"
  printf "          %slogs%s     cd %s && %s -f %s logs -f\n" "$BOLD" "$RESET" "$DIR" "$DC -p $PROJECT" "$COMPOSE_FILE"
  printf "          %sstop%s     cd %s && %s -f %s down\n" "$BOLD" "$RESET" "$DIR" "$DC -p $PROJECT" "$COMPOSE_FILE"
  printf "          %supdate%s   re-run this installer\n\n" "$BOLD" "$RESET"

  if [ "$APP_URL_FINAL" != "${APP_URL_FINAL#http://}" ]; then
    printf "        %sCustom domain%s   %spoint your domain's A record at this server's IP, then save it in%s\n" "$DIM" "$RESET" "$WHITE" "$RESET"
    printf "                        %sSettings → Domain. HTTPS activates automatically — no certs, no restarts.%s\n" "$WHITE" "$RESET"
  fi
  printf "        %sCalm seas. ⚓%s\n\n" "$DIM" "$RESET"
}

# ──────────────────────────────────────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────────────────────────────────────
INSTALL_START="$(date +%s)"

main() {
  banner
  preflight
  fetch_source
  write_env
  launch
  wait_healthy || true
  success
}

# Run only when executed (not sourced) — keeps the functions unit-testable.
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
fi
