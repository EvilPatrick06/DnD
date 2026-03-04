#!/bin/bash
# backup.sh — Daily backup of BMO data to Google Drive via rclone
#
# Prerequisites:
#   1. rclone installed: sudo apt install rclone
#   2. Google Drive remote configured: rclone config
#      (remote name must be "gdrive" — or change REMOTE below)
#
# Usage:
#   bash backup.sh              # Full backup
#   bash backup.sh --dry-run    # Preview what would be synced
#
# Automated via systemd timer (bmo-backup.timer) or cron:
#   0 3 * * * /home/patrick/bmo/backup.sh >> /home/patrick/bmo/data/backup.log 2>&1

set -euo pipefail

REMOTE="gdrive"
REMOTE_PATH="BMO-Backups"
BMO_DIR="$HOME/bmo"
LOG_FILE="$BMO_DIR/data/backup.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Directories to back up
BACKUP_DIRS=(
    "$BMO_DIR/data"
    "$BMO_DIR/config"
)

# Files to back up individually (sensitive — not .env)
BACKUP_FILES=(
    "$BMO_DIR/requirements.txt"
)

# Files to EXCLUDE (secrets should not go to cloud unencrypted)
EXCLUDE_PATTERNS=(
    "*.pyc"
    "__pycache__/**"
    ".audiocache/**"
    "backup.log"
)

DRY_RUN=""
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN="--dry-run" ;;
    esac
done

log() { echo "[$DATE] $*" | tee -a "$LOG_FILE"; }

# Check rclone remote is configured
if ! rclone listremotes | grep -q "^${REMOTE}:"; then
    log "ERROR: rclone remote '$REMOTE' not configured. Run: rclone config"
    exit 1
fi

log "Starting BMO backup to ${REMOTE}:${REMOTE_PATH}..."

# Build exclude flags
EXCLUDES=""
for pat in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDES="$EXCLUDES --exclude $pat"
done

# Sync each directory
for dir in "${BACKUP_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        dirname=$(basename "$dir")
        log "  Syncing $dirname/..."
        rclone sync "$dir" "${REMOTE}:${REMOTE_PATH}/${dirname}" \
            $EXCLUDES \
            $DRY_RUN \
            --transfers 4 \
            --checkers 8 \
            --low-level-retries 3 \
            --retries 3 \
            --stats-one-line \
            -q
    else
        log "  SKIP: $dir (not found)"
    fi
done

# Copy individual files
for file in "${BACKUP_FILES[@]}"; do
    if [ -f "$file" ]; then
        fname=$(basename "$file")
        log "  Copying $fname..."
        rclone copyto "$file" "${REMOTE}:${REMOTE_PATH}/${fname}" $DRY_RUN -q
    fi
done

log "Backup complete."
