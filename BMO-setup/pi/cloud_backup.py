"""BMO Cloud Backup — S3 backup and restore for BMO data.

Backs up ~/bmo/data/ and ~/bmo/config/ to AWS S3 with daily scheduling
and automatic retention cleanup. Supports point-in-time restore.

Usage:
    from cloud_backup import BmoBackup
    backup = BmoBackup()
    backup.backup_now()
    backup.schedule_daily(hour=3)
"""

import datetime
import os
import tarfile
import tempfile
import threading
import time

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    print("[backup] boto3 not installed — S3 backup disabled")

# ── Configuration ────────────────────────────────────────────────────

AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "")
AWS_S3_PREFIX = os.environ.get("AWS_S3_PREFIX", "bmo-backups")

BMO_DATA_DIR = os.path.expanduser("~/bmo/data")
BMO_CONFIG_DIR = os.path.expanduser("~/bmo/config")

# What gets backed up (relative to ~/bmo/)
BACKUP_TARGETS = [
    "data/chat_history",        # Conversation logs
    "data/known_faces.pkl",     # Face recognition data
    "data/campaign_memory.db",  # D&D campaign SQLite DB
    "data/dnd_gamestate.json",  # Current game state
    "data/recent_chat.json",    # Recent chat buffer
    "data/notes.json",          # Notes
    "data/dnd_sessions",        # D&D session logs
    "config",                   # OAuth tokens, config files
]

# Retention: keep last N daily backups
RETENTION_DAYS = 30


# ── Backup Service ───────────────────────────────────────────────────

class BmoBackup:
    """S3 cloud backup for BMO data and config.

    Creates tar.gz archives of BMO data directories and uploads to S3
    with date-prefixed keys. Supports daily scheduling and automatic
    retention cleanup.

    Args:
        bucket: S3 bucket name (default from AWS_S3_BUCKET env var).
        prefix: S3 key prefix (default from AWS_S3_PREFIX env var).
    """

    def __init__(self, bucket: str = "", prefix: str = ""):
        self.bucket = bucket or AWS_S3_BUCKET
        self.prefix = prefix or AWS_S3_PREFIX
        self._s3 = None
        self._running = False
        self._schedule_thread: threading.Thread | None = None
        self._bmo_root = os.path.expanduser("~/bmo")

        # Initialize S3 client if available
        if BOTO3_AVAILABLE and self.bucket:
            try:
                self._s3 = boto3.client("s3")
                # Quick validation — just checks credentials exist
                self._s3.head_bucket(Bucket=self.bucket)
                print(f"[backup] S3 ready: s3://{self.bucket}/{self.prefix}/")
            except NoCredentialsError:
                print("[backup] AWS credentials not configured — S3 backup disabled")
                self._s3 = None
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                if code in ("403", "404"):
                    print(f"[backup] S3 bucket '{self.bucket}' not accessible ({code})")
                else:
                    print(f"[backup] S3 client error: {e}")
                self._s3 = None
            except Exception as e:
                print(f"[backup] S3 init failed: {e}")
                self._s3 = None
        elif not self.bucket:
            print("[backup] AWS_S3_BUCKET not set — S3 backup disabled")

    # ── Backup ───────────────────────────────────────────────────────

    def backup_now(self) -> dict:
        """Create a backup of BMO data and upload to S3.

        Returns:
            Dict with {ok, date, s3_key, size_bytes, files_count} on success,
            or {ok: False, error: str} on failure.
        """
        if not self._s3:
            return {"ok": False, "error": "S3 not configured"}

        date_str = datetime.date.today().isoformat()
        s3_key = f"{self.prefix}/{date_str}/bmo-data.tar.gz"

        print(f"[backup] Starting backup for {date_str}...")

        try:
            # Create tar.gz in a temp file
            with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
                tmp_path = tmp.name

            files_count = self._create_archive(tmp_path)

            if files_count == 0:
                print("[backup] No files to back up — skipping")
                _safe_remove(tmp_path)
                return {"ok": False, "error": "No files to back up"}

            # Get file size
            size_bytes = os.path.getsize(tmp_path)
            size_mb = round(size_bytes / (1024 * 1024), 2)

            # Upload to S3
            print(f"[backup] Uploading {size_mb} MB to s3://{self.bucket}/{s3_key}")
            self._s3.upload_file(
                tmp_path,
                self.bucket,
                s3_key,
                ExtraArgs={"StorageClass": "STANDARD_IA"},
            )

            # Clean up temp file
            _safe_remove(tmp_path)

            # Auto-cleanup old backups
            deleted = self._cleanup_old_backups()

            print(f"[backup] Backup complete: {files_count} files, {size_mb} MB")
            if deleted:
                print(f"[backup] Cleaned up {deleted} old backup(s)")

            return {
                "ok": True,
                "date": date_str,
                "s3_key": s3_key,
                "size_bytes": size_bytes,
                "files_count": files_count,
                "old_deleted": deleted,
            }

        except Exception as e:
            _safe_remove(tmp_path)
            print(f"[backup] Backup failed: {e}")
            return {"ok": False, "error": str(e)}

    def _create_archive(self, output_path: str) -> int:
        """Create a tar.gz archive of all backup targets.

        Args:
            output_path: Path to write the tar.gz file.

        Returns:
            Number of files included in the archive.
        """
        files_count = 0

        with tarfile.open(output_path, "w:gz") as tar:
            for target in BACKUP_TARGETS:
                full_path = os.path.join(self._bmo_root, target)

                if not os.path.exists(full_path):
                    continue

                if os.path.isdir(full_path):
                    for root, _dirs, files in os.walk(full_path):
                        for fname in files:
                            fpath = os.path.join(root, fname)
                            arcname = os.path.relpath(fpath, self._bmo_root)
                            try:
                                tar.add(fpath, arcname=arcname)
                                files_count += 1
                            except (PermissionError, OSError) as e:
                                print(f"[backup] Skipping {fpath}: {e}")
                elif os.path.isfile(full_path):
                    arcname = os.path.relpath(full_path, self._bmo_root)
                    try:
                        tar.add(full_path, arcname=arcname)
                        files_count += 1
                    except (PermissionError, OSError) as e:
                        print(f"[backup] Skipping {full_path}: {e}")

        return files_count

    # ── Restore ──────────────────────────────────────────────────────

    def restore(self, date: str, confirm: bool = False) -> dict:
        """Download and restore a backup from S3 for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format.
            confirm: Must be True to actually extract files. Safety check
                     to prevent accidental overwrites.

        Returns:
            Dict with {ok, date, files_restored} on success,
            or {ok: False, error: str} on failure.
        """
        if not self._s3:
            return {"ok": False, "error": "S3 not configured"}

        if not confirm:
            return {
                "ok": False,
                "error": "Restore requires confirm=True. This will overwrite "
                         "existing data in ~/bmo/data/ and ~/bmo/config/.",
            }

        s3_key = f"{self.prefix}/{date}/bmo-data.tar.gz"

        print(f"[backup] Restoring backup from {date}...")

        try:
            # Download to temp file
            with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
                tmp_path = tmp.name

            self._s3.download_file(self.bucket, s3_key, tmp_path)

            # Extract to ~/bmo/
            files_restored = 0
            with tarfile.open(tmp_path, "r:gz") as tar:
                # Security: filter out absolute paths and path traversal
                members = []
                for member in tar.getmembers():
                    # Skip absolute paths and parent directory references
                    if member.name.startswith("/") or ".." in member.name:
                        print(f"[backup] Skipping unsafe path: {member.name}")
                        continue
                    members.append(member)
                    files_restored += 1

                tar.extractall(path=self._bmo_root, members=members)

            _safe_remove(tmp_path)

            print(f"[backup] Restore complete: {files_restored} files from {date}")
            return {
                "ok": True,
                "date": date,
                "files_restored": files_restored,
            }

        except ClientError as e:
            _safe_remove(tmp_path)
            code = e.response.get("Error", {}).get("Code", "")
            if code == "404":
                return {"ok": False, "error": f"No backup found for date {date}"}
            return {"ok": False, "error": str(e)}
        except Exception as e:
            _safe_remove(tmp_path)
            print(f"[backup] Restore failed: {e}")
            return {"ok": False, "error": str(e)}

    # ── List Backups ─────────────────────────────────────────────────

    def list_backups(self) -> list[dict]:
        """List all available backups in S3.

        Returns:
            List of dicts with {date, s3_key, size_bytes, last_modified}.
            Sorted newest-first.
        """
        if not self._s3:
            return []

        try:
            paginator = self._s3.get_paginator("list_objects_v2")
            backups = []

            for page in paginator.paginate(Bucket=self.bucket, Prefix=self.prefix + "/"):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    # Parse date from key: prefix/YYYY-MM-DD/bmo-data.tar.gz
                    parts = key.split("/")
                    if len(parts) >= 2 and parts[-1] == "bmo-data.tar.gz":
                        date = parts[-2]
                        backups.append({
                            "date": date,
                            "s3_key": key,
                            "size_bytes": obj.get("Size", 0),
                            "last_modified": obj.get("LastModified", "").isoformat()
                                if hasattr(obj.get("LastModified", ""), "isoformat")
                                else str(obj.get("LastModified", "")),
                        })

            # Sort newest first
            backups.sort(key=lambda b: b["date"], reverse=True)
            return backups

        except Exception as e:
            print(f"[backup] Failed to list backups: {e}")
            return []

    # ── Retention Cleanup ────────────────────────────────────────────

    def _cleanup_old_backups(self) -> int:
        """Delete backups older than RETENTION_DAYS.

        Returns:
            Number of backups deleted.
        """
        backups = self.list_backups()
        if len(backups) <= RETENTION_DAYS:
            return 0

        # Delete everything beyond the retention window
        to_delete = backups[RETENTION_DAYS:]
        deleted = 0

        for backup in to_delete:
            try:
                self._s3.delete_object(Bucket=self.bucket, Key=backup["s3_key"])
                print(f"[backup] Deleted old backup: {backup['date']}")
                deleted += 1
            except Exception as e:
                print(f"[backup] Failed to delete {backup['s3_key']}: {e}")

        return deleted

    # ── Daily Scheduling ─────────────────────────────────────────────

    def schedule_daily(self, hour: int = 3):
        """Start a background daemon thread that runs backup daily at the given hour.

        Uses a simple sleep loop that checks every 60 seconds if it's time
        to run the backup. Only runs once per calendar day.

        Args:
            hour: Hour of day (0-23) to run the backup. Default 3 AM.
        """
        if self._running:
            print("[backup] Daily schedule already running")
            return

        if not self._s3:
            print("[backup] S3 not configured — daily schedule not started")
            return

        self._running = True
        self._schedule_thread = threading.Thread(
            target=self._schedule_loop,
            args=(hour,),
            daemon=True,
        )
        self._schedule_thread.start()
        print(f"[backup] Daily backup scheduled at {hour:02d}:00")

    def stop_schedule(self):
        """Stop the daily backup schedule."""
        self._running = False
        if self._schedule_thread:
            self._schedule_thread.join(timeout=5)
            self._schedule_thread = None
        print("[backup] Daily schedule stopped")

    def _schedule_loop(self, hour: int):
        """Background loop for daily scheduling.

        Checks once per minute whether the current hour matches and hasn't
        already run today. Simple and reliable.
        """
        last_backup_date = ""

        while self._running:
            now = datetime.datetime.now()
            today = now.strftime("%Y-%m-%d")

            # Run backup if it's the right hour and we haven't run today
            if now.hour == hour and today != last_backup_date:
                print(f"[backup] Running scheduled daily backup...")
                result = self.backup_now()
                if result.get("ok"):
                    last_backup_date = today
                    print(f"[backup] Scheduled backup complete: {result}")
                else:
                    print(f"[backup] Scheduled backup failed: {result.get('error')}")

            # Sleep for 60 seconds before checking again
            for _ in range(60):
                if not self._running:
                    return
                time.sleep(1)


# ── Helpers ──────────────────────────────────────────────────────────

def _safe_remove(path: str):
    """Remove a file, ignoring errors if it doesn't exist."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        pass
