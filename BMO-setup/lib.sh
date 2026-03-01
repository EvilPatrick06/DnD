#!/bin/bash
# lib.sh — Shared helper functions for all BMO scripts
# Source this at the top of any script:
#   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#   source "$SCRIPT_DIR/lib.sh"

# ── Logging ───────────────────────────────────────────────────────────
LOG_FILE="${LOG_FILE:-/tmp/bmo-$(basename "$0" .sh)-$(date +%Y%m%d-%H%M%S).log}"

log() {
    echo "[$(date +'%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_ok() { log "  ✓ $*"; }
log_warn() { log "  ⚠ $*"; }
log_err() { log "  ✗ $*"; }

# ── .env Loading ──────────────────────────────────────────────────────
load_env() {
    local env_file="${1:-$SCRIPT_DIR/.env}"
    if [ -f "$env_file" ]; then
        set -a; source "$env_file"; set +a
        log "Loaded config from $env_file"
    fi
}

# ── .env Validation ───────────────────────────────────────────────────
# Usage: require_env "EC2_IP" "SSH_KEY_PATH" "AWS_REGION"
require_env() {
    local missing=0
    for key in "$@"; do
        if [ -z "${!key:-}" ]; then
            log_err "$key not set (add to .env or pass as argument)"
            missing=1
        fi
    done
    if [ "$missing" -eq 1 ]; then
        echo ""
        echo "Copy .env.template to .env and fill in required values:"
        echo "  cp .env.template .env && nano .env"
        exit 1
    fi
}

# ── Pre-Flight Checks ────────────────────────────────────────────────
# Usage: preflight_check "aws" "ssh" "curl" "git"
preflight_check() {
    local missing=0
    for cmd in "$@"; do
        if ! command -v "$cmd" &>/dev/null; then
            log_err "$cmd not found — install it first"
            missing=1
        fi
    done
    if [ "$missing" -eq 1 ]; then exit 1; fi
}

# Verify SSH key exists and has correct permissions
check_ssh_key() {
    local key="${1:-$HOME/.ssh/aws-key.pem}"
    if [ ! -f "$key" ]; then
        log_err "SSH key not found: $key"
        return 1
    fi
    # Fix permissions if wrong (common issue)
    local perms
    perms=$(stat -c%a "$key" 2>/dev/null || stat -f%A "$key" 2>/dev/null || echo "unknown")
    if [ "$perms" != "600" ] && [ "$perms" != "unknown" ]; then
        chmod 600 "$key"
        log "Fixed SSH key permissions: $key → 600"
    fi
    return 0
}

# ── Retry Wrapper ─────────────────────────────────────────────────────
# Usage: retry 3 ssh user@host "command"
# Usage: retry 3 scp file user@host:/path
retry() {
    local max_attempts="$1"
    shift
    local attempt=1
    while [ "$attempt" -le "$max_attempts" ]; do
        if "$@"; then
            return 0
        fi
        if [ "$attempt" -lt "$max_attempts" ]; then
            local wait=$((2 ** attempt))
            log_warn "Attempt $attempt/$max_attempts failed — retrying in ${wait}s..."
            sleep "$wait"
        fi
        attempt=$((attempt + 1))
    done
    log_err "Failed after $max_attempts attempts: $*"
    return 1
}

# ── SSH/SCP with retry ────────────────────────────────────────────────
# These use $SSH_OPTS (set by calling script)
retry_ssh() {
    local dest="$1"; shift
    retry 3 ssh $SSH_OPTS "$dest" "$@"
}

retry_scp() {
    retry 3 scp $SSH_OPTS "$@"
}

# ── Wait for Host Reachable ───────────────────────────────────────────
# Usage: wait_for_host user@host [max_seconds]
wait_for_host() {
    local dest="$1"
    local max="${2:-120}"
    local elapsed=0
    log "Waiting for $dest to be reachable (timeout: ${max}s)..."
    while [ "$elapsed" -lt "$max" ]; do
        if ssh $SSH_OPTS -o ConnectTimeout=5 "$dest" "echo ok" &>/dev/null; then
            log_ok "$dest reachable"
            return 0
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        echo -ne "\r  Waiting... ${elapsed}s / ${max}s"
    done
    echo ""
    log_err "$dest not reachable after ${max}s"
    return 1
}

# ── Service Verification ─────────────────────────────────────────────
# Usage: verify_service "bmo" [ssh_dest]
# If ssh_dest is provided, checks remote host. Otherwise checks local.
verify_service() {
    local service="$1"
    local dest="${2:-}"
    local cmd="systemctl is-active $service"

    for i in {1..10}; do
        local status
        if [ -n "$dest" ]; then
            status=$(ssh $SSH_OPTS -o ConnectTimeout=5 "$dest" "$cmd" 2>/dev/null) || true
        else
            status=$($cmd 2>/dev/null) || true
        fi
        if [ "$status" = "active" ]; then
            log_ok "$service running"
            return 0
        fi
        sleep 1
    done
    log_warn "$service not running after 10s"
    return 1
}

# ── HTTP Health Check ─────────────────────────────────────────────────
# Usage: check_http "http://localhost:5000" "BMO Web UI"
check_http() {
    local url="$1"
    local name="${2:-$url}"
    for i in {1..10}; do
        if curl -sf -o /dev/null --connect-timeout 3 "$url" 2>/dev/null; then
            log_ok "$name responding at $url"
            return 0
        fi
        sleep 2
    done
    log_warn "$name not responding at $url"
    return 1
}

# ── Disk Space Check ─────────────────────────────────────────────────
# Usage: check_disk_space /opt/ai-server 10  (require 10GB free)
check_disk_space() {
    local path="$1"
    local required_gb="${2:-5}"
    local avail_kb
    avail_kb=$(df -k "$path" 2>/dev/null | tail -1 | awk '{print $4}')
    local avail_gb=$((avail_kb / 1048576))
    if [ "$avail_gb" -lt "$required_gb" ]; then
        log_err "Only ${avail_gb}GB free at $path (need ${required_gb}GB)"
        return 1
    fi
    log_ok "${avail_gb}GB free at $path"
    return 0
}

# ── User Confirmation ────────────────────────────────────────────────
# Usage: confirm "Delete all files?" (respects $FORCE flag)
confirm() {
    if [ "${FORCE:-false}" = true ]; then return 0; fi
    read -rp "  $1 [y/N] " choice
    [ "$choice" = "y" ] || [ "$choice" = "Y" ]
}

# ── Bandwidth Estimation ─────────────────────────────────────────────
estimate_transfer() {
    local path="$1"
    local size
    size=$(du -sh "$path" 2>/dev/null | awk '{print $1}')
    log "Transfer size: $size"
}

# ── Backup Before Modify ─────────────────────────────────────────────
backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        cp "$file" "${file}.bak.$(date +%s)"
    fi
}
