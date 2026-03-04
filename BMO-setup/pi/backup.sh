#!/bin/bash
# backup.sh — Full system backup of BMO Pi to Google Drive via rclone
#
# Features:
#   - Backs up / (ext4) and /boot/firmware (vfat) directly to Google Drive
#   - rclone sync with checksum change detection (no local staging)
#   - Keeps last 2 backups — deletes oldest when 3rd is created
#   - Change manifest: logs what files changed since last backup
#   - Discord webhook alerts on success/failure
#   - Verifies upload with post-check
#
# Prerequisites:
#   1. rclone configured: rclone config (remote "gdrive")
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
LOG_FILE="$BMO_DIR/data/backup.log"
MANIFEST_FILE="$BMO_DIR/data/backup-manifest.txt"
RCLONE_LOG="$BMO_DIR/data/rclone-backup.log"
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
    "/proc/**" "/sys/**" "/dev/**" "/tmp/**" "/run/**" "/mnt/**" "/media/**"
    "/var/tmp/**" "/var/cache/apt/**" "/var/lib/docker/overlay2/**"
    "/swap.img" "/swapfile"
    "**/node_modules/**" "**/.cache/**" "**/__pycache__/**" "**/*.pyc"
    "**/.audiocache/**" "**/*.swp" "**/*.tmp"
)

DRY_RUN=""
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN="--dry-run" ;;
    esac
done

# ── Helpers ────────────────────────────────────────────────────────

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

discord_notify() {
    local color="$1" title="$2" msg="$3"
    [ -z "$DISCORD_WEBHOOK" ] && return
    local payload
    payload=$(cat <<EOF
{"embeds":[{"title":"$title","description":"$msg","color":$color,"footer":{"text":"BMO Backup · $(date '+%Y-%m-%d %H:%M:%S')"}}]}
EOF
    )
    curl -s -H "Content-Type: application/json" -d "$payload" "$DISCORD_WEBHOOK" > /dev/null 2>&1 || true
}

# ── Pre-flight checks ─────────────────────────────────────────────

mkdir -p "$BMO_DIR/data"

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

# Verify rclone can actually access the remote (catches expired OAuth)
if ! $RCLONE lsd "${REMOTE}:" --max-depth 0 > /dev/null 2>&1; then
    log "ERROR: Cannot access rclone remote '$REMOTE' — check auth/token"
    discord_notify 16711680 "❌ BMO Backup Failed" "Cannot access Google Drive — OAuth token may be expired. Run: rclone config reconnect gdrive:"
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

TOTAL_TRANSFERRED=0
TOTAL_SIZE=0
ERRORS=0

# ── Back up each partition directly to Google Drive ───────────────

for entry in "${BACKUP_PARTITIONS[@]}"; do
    IFS=":" read -r mount_point label <<< "$entry"

    if ! mountpoint -q "$mount_point" 2>/dev/null && [ "$mount_point" != "/" ]; then
        log "  SKIP: $mount_point not mounted"
        continue
    fi

    log "Backing up $mount_point → ${BACKUP_DIR}/$label (direct upload)..."

    # Build rclone filter args
    FILTER_ARGS=""
    if [ "$mount_point" = "/" ]; then
        for exc in "${EXCLUDES[@]}"; do
            FILTER_ARGS="$FILTER_ARGS --exclude=$exc"
        done
    fi

    # Sync directly from filesystem to Google Drive (no local staging)
    > "$RCLONE_LOG"
    if $RCLONE sync "$mount_point/" "${REMOTE}:${BACKUP_DIR}/$label/" \
        $FILTER_ARGS \
        --transfers 4 \
        --checkers 8 \
        --retries 3 \
        --low-level-retries 3 \
        --stats 0 \
        --log-file="$RCLONE_LOG" \
        --log-level INFO \
        --stats-one-line-date \
        $DRY_RUN \
        2>&1; then
        log "  rclone sync for $label completed"
    else
        rc=$?
        log "  ERROR: rclone sync for $label failed (exit code $rc)"
        log "  rclone log tail:"
        tail -5 "$RCLONE_LOG" | while read -r line; do log "    $line"; done
        ((ERRORS++)) || true
    fi

    # Count transferred files from rclone log
    transferred=$(grep -c "^.*: Copied (new)$\|^.*: Copied (replaced existing)$\|^.*: Updated modification time$" "$RCLONE_LOG" 2>/dev/null || echo 0)
    TOTAL_TRANSFERRED=$((TOTAL_TRANSFERRED + transferred))

    log "  $label: $transferred files transferred to Drive"

    # Log changed files to manifest
    if [ "$transferred" -gt 0 ]; then
        echo "## $label ($mount_point) — $transferred files" >> "$MANIFEST_FILE"
        grep "Copied\|Updated" "$RCLONE_LOG" | tail -100 >> "$MANIFEST_FILE" 2>/dev/null || true
        echo "" >> "$MANIFEST_FILE"
    fi
done

# ── Verify upload ─────────────────────────────────────────────────

log "Verifying backup on Google Drive..."
REMOTE_DIRS=$($RCLONE lsd "${REMOTE}:${BACKUP_DIR}/" 2>/dev/null | wc -l)
if [ "$REMOTE_DIRS" -eq 0 ] && [ -z "$DRY_RUN" ]; then
    log "ERROR: Verification failed — backup directory is empty on Google Drive!"
    ((ERRORS++)) || true
else
    REMOTE_FILES=$($RCLONE size "${REMOTE}:${BACKUP_DIR}/" --json 2>/dev/null)
    remote_count=$(echo "$REMOTE_FILES" | grep -oP '"count":\K\d+' 2>/dev/null || echo "?")
    remote_bytes=$(echo "$REMOTE_FILES" | grep -oP '"bytes":\K\d+' 2>/dev/null || echo "0")
    remote_size=$(numfmt --to=iec "$remote_bytes" 2>/dev/null || echo "${remote_bytes}B")
    log "  Verified: $remote_count files, $remote_size on Drive"
    TOTAL_SIZE=$remote_bytes
fi

# ── Upload manifest + logs ────────────────────────────────────────

if [ -z "$DRY_RUN" ]; then
    $RCLONE copyto "$MANIFEST_FILE" "${REMOTE}:${BACKUP_DIR}/manifest.txt" 2>/dev/null || true
    $RCLONE copyto "$LOG_FILE" "${REMOTE}:${BACKUP_DIR}/backup.log" 2>/dev/null || true
fi

# ── Summary ───────────────────────────────────────────────────────

TOTAL_SIZE_HUMAN=$(numfmt --to=iec "$TOTAL_SIZE" 2>/dev/null || echo "${TOTAL_SIZE}B")
DURATION=$SECONDS

if [ "$ERRORS" -gt 0 ]; then
    log "Backup completed with $ERRORS error(s) — $TOTAL_TRANSFERRED files uploaded in ${DURATION}s"
    discord_notify 16744448 "⚠️ BMO Backup Completed (with errors)" \
        "$TOTAL_TRANSFERRED files uploaded\\n$ERRORS error(s) — check logs\\nTotal: $TOTAL_SIZE_HUMAN\\nDuration: ${DURATION}s"
else
    log "Backup complete — $TOTAL_TRANSFERRED files uploaded, $TOTAL_SIZE_HUMAN in ${DURATION}s"
    discord_notify 65280 "✅ BMO Backup Complete" \
        "$TOTAL_TRANSFERRED files uploaded ($TOTAL_SIZE_HUMAN)\\nTarget: ${BACKUP_DIR}\\nDuration: ${DURATION}s"
fi

log "═══════════════════════════════════════════════════"
