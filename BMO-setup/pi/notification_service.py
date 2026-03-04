"""BMO Notification Service — KDE Connect notification bridge.

Monitors notifications from Android phone and Windows PC via KDE Connect D-Bus,
deduplicates cross-device alerts, announces via TTS, and supports voice replies.

Requirements:
    sudo apt install kdeconnect
    Phone + PC must be paired with the Pi via KDE Connect.

Usage:
    from notification_service import NotificationService
    notifier = NotificationService(voice_pipeline=voice, socketio=socketio)
    notifier.start()
"""

import hashlib
import json
import os
import subprocess
import threading
import time

SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "data", "settings.json")
MAX_HISTORY = 100
DEDUP_WINDOW = 10  # seconds — suppress duplicate notifications within this window


class NotificationService:
    """Bridges KDE Connect notifications to BMO voice + web UI."""

    def __init__(self, voice_pipeline=None, socketio=None):
        self.voice = voice_pipeline
        self.socketio = socketio
        self._running = False
        self._thread = None
        self._history = []  # list of notification dicts (newest first)
        self._seen_hashes = {}  # hash → timestamp for dedup
        self._lock = threading.Lock()
        self._blocklist = set()  # app package names to ignore
        self._enabled = True
        self._devices = {}  # device_id → device_name
        self._load_settings()

    # ── Lifecycle ────────────────────────────────────────────────────

    def start(self):
        """Start monitoring KDE Connect notifications via D-Bus."""
        if self._running:
            return

        if not self._check_kdeconnect():
            print("[notify] KDE Connect not available — install with: sudo apt install kdeconnect")
            return

        self._running = True
        self._discover_devices()
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        print(f"[notify] Notification service started ({len(self._devices)} devices)")

    def stop(self):
        self._running = False

    def _check_kdeconnect(self) -> bool:
        """Check if KDE Connect CLI is available."""
        try:
            result = subprocess.run(
                ["kdeconnect-cli", "--version"],
                capture_output=True, text=True, timeout=5,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _discover_devices(self):
        """Find paired KDE Connect devices."""
        try:
            result = subprocess.run(
                ["kdeconnect-cli", "--list-available", "--id-name-only"],
                capture_output=True, text=True, timeout=10,
            )
            self._devices = {}
            for line in result.stdout.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                # Format: "device_id device_name" or "device_id - device_name"
                parts = line.split(" ", 1)
                if len(parts) == 2:
                    self._devices[parts[0]] = parts[1].lstrip("- ").strip()

            if not self._devices:
                # Try alternative format
                result2 = subprocess.run(
                    ["kdeconnect-cli", "--list-devices"],
                    capture_output=True, text=True, timeout=10,
                )
                for line in result2.stdout.strip().split("\n"):
                    if "paired" in line.lower() and "reachable" in line.lower():
                        # Format: "- DeviceName: DeviceID (paired and reachable)"
                        parts = line.split(":")
                        if len(parts) >= 2:
                            name = parts[0].strip("- ").strip()
                            dev_id = parts[1].split("(")[0].strip()
                            self._devices[dev_id] = name

            if self._devices:
                print(f"[notify] Found devices: {', '.join(self._devices.values())}")
            else:
                print("[notify] No paired KDE Connect devices found")
        except Exception as e:
            print(f"[notify] Device discovery failed: {e}")

    # ── Monitoring Loop ──────────────────────────────────────────────

    def _monitor_loop(self):
        """Monitor KDE Connect notifications via dbus-monitor."""
        try:
            # Use dbus-monitor to watch for KDE Connect notification signals
            proc = subprocess.Popen(
                [
                    "dbus-monitor",
                    "--session",
                    "type='signal',interface='org.kde.kdeconnect.device.notifications'",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
            )

            buffer = []
            while self._running:
                line = proc.stdout.readline()
                if not line:
                    time.sleep(0.1)
                    continue

                buffer.append(line.strip())

                # Process complete signal blocks
                if line.strip() == "" and buffer:
                    self._process_dbus_signal(buffer)
                    buffer = []

                # Keep buffer from growing too large
                if len(buffer) > 50:
                    self._process_dbus_signal(buffer)
                    buffer = []

            proc.terminate()
        except Exception as e:
            print(f"[notify] Monitor loop error: {e}")
            # Fallback: poll notifications via CLI
            self._poll_loop()

    def _poll_loop(self):
        """Fallback: poll for notifications via kdeconnect-cli."""
        print("[notify] Falling back to polling mode")
        known_ids = set()
        while self._running:
            try:
                for device_id in self._devices:
                    result = subprocess.run(
                        ["kdeconnect-cli", "--device", device_id, "--list-notifications"],
                        capture_output=True, text=True, timeout=10,
                    )
                    for line in result.stdout.strip().split("\n"):
                        line = line.strip()
                        if not line:
                            continue
                        # Parse notification lines
                        notif_id = hashlib.md5(line.encode()).hexdigest()[:12]
                        if notif_id not in known_ids:
                            known_ids.add(notif_id)
                            device_name = self._devices.get(device_id, "Unknown")
                            self._handle_notification(
                                app="unknown",
                                title="",
                                body=line,
                                device=device_name,
                                device_id=device_id,
                                notif_id=notif_id,
                            )
                # Keep known_ids from growing unbounded
                if len(known_ids) > 500:
                    known_ids = set(list(known_ids)[-200:])
            except Exception as e:
                print(f"[notify] Poll error: {e}")
            time.sleep(5)

    def _process_dbus_signal(self, lines: list[str]):
        """Parse a D-Bus signal block for notification data."""
        signal_line = ""
        strings = []
        for line in lines:
            if line.startswith("signal"):
                signal_line = line
            if "string" in line:
                # Extract string value: string "value"
                start = line.find('"')
                end = line.rfind('"')
                if start >= 0 and end > start:
                    strings.append(line[start + 1 : end])

        if "notificationPosted" not in signal_line:
            return

        # Try to extract device ID from signal path
        device_id = ""
        if "/modules/kdeconnect/devices/" in signal_line:
            parts = signal_line.split("/modules/kdeconnect/devices/")
            if len(parts) > 1:
                device_id = parts[1].split("/")[0]

        # strings typically: [notif_id, app_name, title, body, ...]
        notif_id = strings[0] if len(strings) > 0 else ""
        app = strings[1] if len(strings) > 1 else "unknown"
        title = strings[2] if len(strings) > 2 else ""
        body = strings[3] if len(strings) > 3 else ""
        device_name = self._devices.get(device_id, "Unknown Device")

        if notif_id or title or body:
            self._handle_notification(
                app=app,
                title=title,
                body=body,
                device=device_name,
                device_id=device_id,
                notif_id=notif_id,
            )

    # ── Notification Processing ──────────────────────────────────────

    def _handle_notification(self, app: str, title: str, body: str,
                              device: str, device_id: str, notif_id: str):
        """Process a single notification — dedup, filter, announce, store."""
        if not self._enabled:
            return

        # Check blocklist
        if app.lower() in self._blocklist:
            return

        # Deduplication: hash the content, suppress if seen within window
        content = f"{app}:{title}:{body}"
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        now = time.time()

        with self._lock:
            if content_hash in self._seen_hashes:
                if now - self._seen_hashes[content_hash] < DEDUP_WINDOW:
                    return  # Duplicate from another device
            self._seen_hashes[content_hash] = now

            # Clean old hashes
            cutoff = now - DEDUP_WINDOW * 2
            self._seen_hashes = {
                h: t for h, t in self._seen_hashes.items() if t > cutoff
            }

        # Build notification record
        notif = {
            "id": notif_id or content_hash,
            "app": app,
            "title": title,
            "body": body,
            "device": device,
            "device_id": device_id,
            "timestamp": now,
            "read": False,
        }

        # Store in history
        with self._lock:
            self._history.insert(0, notif)
            if len(self._history) > MAX_HISTORY:
                self._history = self._history[:MAX_HISTORY]

        print(f"[notify] {device} → {app}: {title} — {body[:60]}")

        # Emit to web GUI
        if self.socketio:
            self.socketio.emit("notification", notif)

        # Announce via TTS
        if self.voice:
            announcement = self._format_announcement(app, title, body, device)
            notif_volume = self._load_notif_volume()
            try:
                self.voice.speak(announcement, volume=notif_volume)
                # Auto-enter conversation mode after announcing
                if hasattr(self.voice, 'start_conversation'):
                    self.voice.start_conversation()
            except Exception as e:
                print(f"[notify] TTS failed: {e}")

    def _format_announcement(self, app: str, title: str, body: str, device: str) -> str:
        """Format notification for TTS."""
        # Friendly app name mapping
        app_names = {
            "com.google.android.apps.messaging": "text message",
            "com.android.mms": "text message",
            "com.whatsapp": "WhatsApp message",
            "com.discord": "Discord notification",
            "com.slack": "Slack message",
            "com.microsoft.office.outlook": "email",
            "com.google.android.gm": "email",
            "com.facebook.orca": "Messenger message",
            "com.instagram.android": "Instagram notification",
        }
        friendly_app = app_names.get(app, app.split(".")[-1] if "." in app else app)

        parts = []
        if title and body:
            parts.append(f"You got a {friendly_app} from {title}: {body}")
        elif title:
            parts.append(f"You got a {friendly_app}: {title}")
        elif body:
            parts.append(f"You got a {friendly_app}: {body}")
        else:
            parts.append(f"New {friendly_app} notification")

        return " ".join(parts)

    def _load_notif_volume(self) -> int:
        """Load notification volume from settings."""
        try:
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
                return settings.get("volume", {}).get("notifications", 80)
        except Exception:
            pass
        return 80

    # ── Reply ────────────────────────────────────────────────────────

    def reply(self, notif_id: str, message: str, device_id: str = "") -> bool:
        """Reply to a notification via KDE Connect.

        Args:
            notif_id: The notification ID to reply to.
            message: The reply message text.
            device_id: Optional device ID. If empty, tries all devices.

        Returns:
            True if reply was sent successfully.
        """
        devices_to_try = [device_id] if device_id else list(self._devices.keys())

        for dev_id in devices_to_try:
            try:
                result = subprocess.run(
                    [
                        "kdeconnect-cli",
                        "--device", dev_id,
                        "--reply", notif_id,
                        "--message", message,
                    ],
                    capture_output=True, text=True, timeout=10,
                )
                if result.returncode == 0:
                    print(f"[notify] Reply sent via {self._devices.get(dev_id, dev_id)}")
                    return True
                else:
                    print(f"[notify] Reply failed: {result.stderr.strip()}")
            except Exception as e:
                print(f"[notify] Reply error: {e}")

        return False

    # ── History & Settings ───────────────────────────────────────────

    def get_history(self, limit: int = 50) -> list[dict]:
        """Get recent notification history."""
        with self._lock:
            return self._history[:limit]

    def clear_history(self):
        with self._lock:
            self._history.clear()

    def get_settings(self) -> dict:
        return {
            "enabled": self._enabled,
            "blocklist": sorted(self._blocklist),
            "devices": self._devices,
        }

    def update_settings(self, enabled: bool = None, blocklist: list = None):
        if enabled is not None:
            self._enabled = enabled
        if blocklist is not None:
            self._blocklist = set(blocklist)
        self._save_settings()

    def _save_settings(self):
        try:
            os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
            settings = {}
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
            settings["notifications"] = {
                "enabled": self._enabled,
                "blocklist": sorted(self._blocklist),
            }
            with open(SETTINGS_PATH, "w") as f:
                json.dump(settings, f, indent=2)
        except Exception as e:
            print(f"[notify] Save settings failed: {e}")

    def _load_settings(self):
        try:
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
                notif = settings.get("notifications", {})
                self._enabled = notif.get("enabled", True)
                self._blocklist = set(notif.get("blocklist", []))
        except Exception:
            pass
