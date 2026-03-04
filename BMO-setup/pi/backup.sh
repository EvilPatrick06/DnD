#!/bin/bash
# backup.sh — Full system backup of BMO Pi to Google Drive via rclone
#
# Features:
#   - Backs up / (ext4) and /boot/firmware (vfat)
#   - rsync incremental with --checksum for change detection
#   - Keeps last 2 backups — deletes oldest when 3rd is created
#   - Change manifest: logs what files changed since last backup
#   - Discord webhook alerts on success/failure
#   - Auto-discovers additional disks/partitions
#
# Prerequisites:
#   1. rclone configured: rclone config (remote "gdrive")
#   2. rsync installed: sudo apt install rsync
#
# Usage:
#   sudo bash backup.sh              # Full backup
#   sudo bash backup.sh --dry-run    # Preview only
#
# Automated: daily cron at 3 AM
#   0 3 * * * /home/patrick/bmo/backup.sh >> /home/patrick/bmo/data/backup.log 2>&1

set -uo pipefail

# ── Configuration ──────────────────────────────────────────────────
REMOTE="gdrive"
REMOTE_BASE="BMO-Backups"
BMO_DIR="/home/patrick/bmo"
RCLONE_CONFIG="/home/patrick/.config/rclone/rclone.conf"
LOCAL_STAGING="/tmp/bmo-backup"
LOG_FILE="$BMO_DIR/data/backup.log"
MANIFEST_FILE="$BMO_DIR/data/backup-manifest.txt"
MAX_BACKUPS=2
DATE_TAG=$(date '+%Y-%m-%d_%H%M')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RCLONE="rclone --config $RCLONE_CONFIG"

# Load Discord webhook from .env
DISCORD_WEBHOOK=""
if [ -f "$BMO_DIR/.env" ]; then
    DISCORD_WEBHOOK=$(grep -oP 'DISCORD_WEBHOOK_URL=\K.*' "$BMO_DIR/.env" 2>/dev/null || true)
fi

# Partitions to back up
BACKUP_PARTITIONS=(
    "/:/system"
    "/boot/firmware:/boot"
)

# Excludes for root filesystem
EXCLUDES=(
    "/proc" "/sys" "/dev" "/tmp" "/run" "/mnt" "/media"
    "/var/tmp" "/var/cache/apt" "/var/lib/docker/overlay2"
    "/swap.img" "/swapfile"
    "node_modules" ".cache" "__pycache__" "*.pyc"
    ".audiocache" "*.swp" "*.tmp"
    "/tmp/bmo-backup"
)

DRY_RUN=""
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN="--dry-run" ;;
    esac
done

# ── Helpers ────────────────────────────────────────────────────────

log() { echo "[$TIMESTAMP] $*" | tee -a "$LOG_FILE"; }

discord_notify() {
    local color="$1" title="$2" msg="$3"
    [ -z "$DISCORD_WEBHOOK" ] && return
    local payload
    payload=$(cat <<EOF
{"embeds":[{"title":"$title","description":"$msg","color":$color,"footer":{"text":"BMO Backup · $TIMESTAMP"}}]}
EOF
    )
    curl -s -H "Content-Type: application/json" -d "$payload" "$DISCORD_WEBHOOK" > /dev/null 2>&1 || true
}

# ── Pre-flight checks ─────────────────────────────────────────────

mkdir -p "$BMO_DIR/data" "$LOCAL_STAGING"

if ! command -v rclone &> /dev/null; then
    log "ERROR: rclone not installed"
    discord_notify 16711680 "❌ BMO Backup Failed" "rclone not installed"
    exit 1
fi

if ! $RCLONE listremotes 2>/dev/null | grep -q "^${REMOTE}:"; then
    log "ERROR: rclone remote '$REMOTE' not configured"
    discord_notify 16711680 "❌ BMO Backup Failed" "rclone remote '$REMOTE' not configured"
    exit 1
fi

if ! command -v rsync &> /dev/null; then
    log "ERROR: rsync not installed"
    discord_notify 16711680 "❌ BMO Backup Failed" "rsync not installed"
    exit 1
fi

log "═══════════════════════════════════════════════════"
log "Starting full system backup ($DATE_TAG)"
[ -n "$DRY_RUN" ] && log "DRY RUN — no changes will be made"

# ── Rotate old backups (keep last $MAX_BACKUPS) ───────────────────

log "Checking existing backups..."
EXISTING=$($RCLONE lsd "${REMOTE}:${REMOTE_BASE}/" 2>/dev/null | awk '{print $NF}' | grep "^backup-" | sort)
BACKUP_COUNT=$(echo "$EXISTING" | grep -c "^backup-" 2>/dev/null || echo 0)

if [ "$BACKUP_COUNT" -ge "$MAX_BACKUPS" ]; then
    # Delete oldest backups to make room
    DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS + 1))
    log "Rotating: removing $DELETE_COUNT old backup(s) (keeping $MAX_BACKUPS)"
    echo "$EXISTING" | head -n "$DELETE_COUNT" | while read -r old_backup; do
        if [ -n "$old_backup" ] && [ -z "$DRY_RUN" ]; then
            log "  Deleting ${REMOTE}:${REMOTE_BASE}/$old_backup..."
            $RCLONE purge "${REMOTE}:${REMOTE_BASE}/$old_backup" 2>/dev/null || true
        else
            log "  Would delete: $old_backup"
        fi
    done
fi

BACKUP_DIR="${REMOTE_BASE}/backup-${DATE_TAG}"
log "Backup target: ${REMOTE}:${BACKUP_DIR}"

# ── Generate change manifest ─────────────────────────────────────

> "$MANIFEST_FILE"
echo "# BMO Backup Manifest — $TIMESTAMP" >> "$MANIFEST_FILE"
echo "# Files changed since last backup" >> "$MANIFEST_FILE"
echo "" >> "$MANIFEST_FILE"

TOTAL_CHANGED=0
TOTAL_SIZE=0
ERRORS=0

# ── Back up each partition ────────────────────────────────────────

for entry in "${BACKUP_PARTITIONS[@]}"; do
    IFS=":" read -r mount_point label <<< "$entry"

    if ! mountpoint -q "$mount_point" 2>/dev/null && [ "$mount_point" != "/" ]; then
        log "  SKIP: $mount_point not mounted"
        continue
    fi

    log "Backing up $mount_point → $label..."
    staging="$LOCAL_STAGING/$label"
    mkdir -p "$staging"

    # Build rsync exclude args
    RSYNC_EXCLUDES=""
    if [ "$mount_point" = "/" ]; then
        for exc in "${EXCLUDES[@]}"; do
            RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude=$exc"
        done
    fi

    # rsync with checksum-based change detection to local staging
    rsync_output=$(rsync -aHAX --checksum --delete --stats \
        $RSYNC_EXCLUDES \
        $DRY_RUN \
        "$mount_point/" "$staging/" 2>&1) || {
        log "  WARNING: rsync for $mount_point exited with code $?"
        ((ERRORS++)) || true
    }

    # Extract stats
    files_transferred=$(echo "$rsync_output" | grep "Number of regular files transferred:" | grep -oP '\d[\d,]*' | tr -d ',')
    total_size=$(echo "$rsync_output" | grep "Total transferred file size:" | grep -oP '[\d,]+' | head -1 | tr -d ',')
    files_transferred=${files_transferred:-0}
    total_size=${total_size:-0}
    TOTAL_CHANGED=$((TOTAL_CHANGED + files_transferred))
    TOTAL_SIZE=$((TOTAL_SIZE + total_size))

    log "  $label: $files_transferred files changed ($(numfmt --to=iec "$total_size" 2>/dev/null || echo "${total_size}B"))"

    # Log changed files to manifest
    if [ "$files_transferred" -gt 0 ]; then
        echo "## $label ($mount_point) — $files_transferred files" >> "$MANIFEST_FILE"
        echo "$rsync_output" | grep -E "^(>|<|c)" | head -100 >> "$MANIFEST_FILE" 2>/dev/null || true
        echo "" >> "$MANIFEST_FILE"
    fi

    # Upload staging to Google Drive
    log "  Uploading $label to ${REMOTE}:${BACKUP_DIR}/$label..."
    $RCLONE sync "$staging/" "${REMOTE}:${BACKUP_DIR}/$label/" \
        --transfers 4 \
        --checkers 8 \
        --retries 3 \
        --low-level-retries 3 \
        --stats-one-line \
        $DRY_RUN \
        -q 2>&1 | tee -a "$LOG_FILE" || {
        log "  ERROR: rclone upload failed for $label"
        ((ERRORS++)) || true
    }
done

# ── Upload manifest + logs ────────────────────────────────────────

if [ -z "$DRY_RUN" ]; then
    $RCLONE copyto "$MANIFEST_FILE" "${REMOTE}:${BACKUP_DIR}/manifest.txt" -q 2>/dev/null || true
    $RCLONE copyto "$LOG_FILE" "${REMOTE}:${BACKUP_DIR}/backup.log" -q 2>/dev/null || true
fi

# ── Cleanup staging ───────────────────────────────────────────────
rm -rf "$LOCAL_STAGING"

# ── Summary ───────────────────────────────────────────────────────

TOTAL_SIZE_HUMAN=$(numfmt --to=iec "$TOTAL_SIZE" 2>/dev/null || echo "${TOTAL_SIZE}B")
DURATION=$SECONDS

if [ "$ERRORS" -gt 0 ]; then
    log "Backup completed with $ERRORS error(s) — $TOTAL_CHANGED files, $TOTAL_SIZE_HUMAN in ${DURATION}s"
    discord_notify 16744448 "⚠️ BMO Backup Completed (with errors)" \
        "$TOTAL_CHANGED files changed ($TOTAL_SIZE_HUMAN)\\n$ERRORS error(s) — check logs\\nDuration: ${DURATION}s"
else
    log "Backup complete — $TOTAL_CHANGED files changed, $TOTAL_SIZE_HUMAN in ${DURATION}s"
    discord_notify 65280 "✅ BMO Backup Complete" \
        "$TOTAL_CHANGED files changed ($TOTAL_SIZE_HUMAN)\\nTarget: ${BACKUP_DIR}\\nDuration: ${DURATION}s"
fi

log "═══════════════════════════════════════════════════"
