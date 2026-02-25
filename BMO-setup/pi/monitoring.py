"""BMO Monitoring & Alerting — Health checks, Pi stats, Discord webhooks.

Periodically checks the health of all BMO infrastructure components:
GPU server, Cloudflare Tunnel, PeerJS signaling, local Ollama, Pi resources.
Routes alerts to OLED face, SocketIO, and optional Discord webhook.

Usage:
    from monitoring import HealthChecker
    checker = HealthChecker(socketio=socketio)
    checker.start()
"""

import json
import os
import threading
import time
from enum import Enum

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("[monitor] requests not installed — HTTP health checks disabled")

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# ── Configuration ────────────────────────────────────────────────────

GPU_SERVER_URL = os.environ.get("GPU_SERVER_URL", "https://ai.yourdomain.com")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# Health check targets: service name → config
HEALTH_CHECKS = {
    "gpu_server": {"url": GPU_SERVER_URL + "/health", "timeout": 5},
    "ollama_local": {"url": "http://localhost:11434/api/tags", "timeout": 3},
    "peerjs": {"url": "http://localhost:9000/health", "timeout": 3},
}

# Default check interval (seconds)
DEFAULT_CHECK_INTERVAL = 60

# Discord webhook cooldown per service (seconds)
DISCORD_COOLDOWN = 300  # 5 minutes


# ── Severity Levels ──────────────────────────────────────────────────

class Severity(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ── Pi System Stats ──────────────────────────────────────────────────

def get_pi_stats() -> dict:
    """Read Raspberry Pi system resource stats.

    Tries /sys/class/thermal for CPU temp (Pi-specific), falls back to psutil,
    then falls back to parsing /proc/ files directly.

    Returns:
        Dict with cpu_temp, cpu_percent, ram_percent, disk_percent.
    """
    stats = {
        "cpu_temp": _read_cpu_temp(),
        "cpu_percent": _read_cpu_percent(),
        "ram_percent": _read_ram_percent(),
        "disk_percent": _read_disk_percent(),
    }
    return stats


def _read_cpu_temp() -> float | None:
    """Read CPU temperature in Celsius."""
    # Pi-specific: /sys/class/thermal/thermal_zone0/temp
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            raw = f.read().strip()
            return round(int(raw) / 1000.0, 1)
    except (FileNotFoundError, ValueError, PermissionError):
        pass

    # Fallback: psutil
    if PSUTIL_AVAILABLE:
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                # Use the first available sensor
                for name, entries in temps.items():
                    if entries:
                        return round(entries[0].current, 1)
        except Exception:
            pass

    return None


def _read_cpu_percent() -> float | None:
    """Read CPU usage percentage."""
    if PSUTIL_AVAILABLE:
        try:
            return psutil.cpu_percent(interval=0.5)
        except Exception:
            pass

    # Fallback: parse /proc/stat
    try:
        with open("/proc/stat") as f:
            line = f.readline()
        parts = line.split()
        if parts[0] == "cpu":
            idle = int(parts[4])
            total = sum(int(p) for p in parts[1:])
            # This is an instantaneous snapshot — not a delta.
            # For accuracy, psutil is preferred.
            usage = 100.0 * (1.0 - idle / total) if total > 0 else 0.0
            return round(usage, 1)
    except (FileNotFoundError, ValueError, IndexError):
        pass

    return None


def _read_ram_percent() -> float | None:
    """Read RAM usage percentage."""
    if PSUTIL_AVAILABLE:
        try:
            mem = psutil.virtual_memory()
            return round(mem.percent, 1)
        except Exception:
            pass

    # Fallback: parse /proc/meminfo
    try:
        meminfo = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    key = parts[0].rstrip(":")
                    meminfo[key] = int(parts[1])  # kB

        total = meminfo.get("MemTotal", 0)
        available = meminfo.get("MemAvailable", 0)
        if total > 0:
            used_pct = 100.0 * (1.0 - available / total)
            return round(used_pct, 1)
    except (FileNotFoundError, ValueError, KeyError):
        pass

    return None


def _read_disk_percent() -> float | None:
    """Read root partition disk usage percentage."""
    if PSUTIL_AVAILABLE:
        try:
            disk = psutil.disk_usage("/")
            return round(disk.percent, 1)
        except Exception:
            pass

    # Fallback: os.statvfs
    try:
        stat = os.statvfs("/")
        total = stat.f_blocks * stat.f_frsize
        free = stat.f_bfree * stat.f_frsize
        if total > 0:
            used_pct = 100.0 * (1.0 - free / total)
            return round(used_pct, 1)
    except (OSError, AttributeError):
        pass

    return None


# ── Alert Routing ────────────────────────────────────────────────────

def _send_discord_webhook(level: Severity, service: str, message: str) -> bool:
    """Send a Discord webhook notification for critical alerts.

    Returns True if sent successfully, False otherwise.
    """
    if not DISCORD_WEBHOOK_URL or not REQUESTS_AVAILABLE:
        return False

    color_map = {
        Severity.CRITICAL: 0xFF0000,  # Red
        Severity.WARNING: 0xFFA500,   # Orange
        Severity.INFO: 0x00BFFF,      # Light blue
    }

    payload = {
        "embeds": [{
            "title": f"BMO Alert: {service}",
            "description": message,
            "color": color_map.get(level, 0x808080),
            "footer": {"text": f"Severity: {level.value}"},
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }]
    }

    try:
        r = requests.post(
            DISCORD_WEBHOOK_URL,
            json=payload,
            timeout=5,
        )
        return r.status_code in (200, 204)
    except Exception as e:
        print(f"[monitor] Discord webhook failed: {e}")
        return False


# ── SNS Notification Handler ─────────────────────────────────────────

def handle_sns_notification(data: dict) -> dict | None:
    """Parse an AWS SNS notification and route to the alert system.

    Detects EC2 spot interruption warnings and other CloudWatch alarms.

    Args:
        data: Raw SNS message payload (JSON-parsed).

    Returns:
        Alert dict {level, service, message} or None if not actionable.
    """
    # SNS wraps the actual message in a "Message" field (JSON string)
    message_str = data.get("Message", "")
    subject = data.get("Subject", "")

    # Try to parse the inner message as JSON
    inner = {}
    if message_str:
        try:
            inner = json.loads(message_str)
        except (json.JSONDecodeError, TypeError):
            inner = {"raw": message_str}

    # Detect EC2 spot interruption warning
    detail_type = inner.get("detail-type", "")
    if "EC2 Spot Instance Interruption" in detail_type or "spot" in subject.lower():
        instance_id = inner.get("detail", {}).get("instance-id", "unknown")
        return {
            "level": Severity.CRITICAL,
            "service": "gpu_server",
            "message": f"Spot instance interruption warning for {instance_id}. "
                       f"GPU server will go down in ~2 minutes.",
        }

    # Detect CloudWatch alarm state changes
    if inner.get("AlarmName"):
        alarm_name = inner["AlarmName"]
        new_state = inner.get("NewStateValue", "UNKNOWN")
        reason = inner.get("NewStateReason", "")
        level = Severity.CRITICAL if new_state == "ALARM" else Severity.INFO
        return {
            "level": level,
            "service": "gpu_server",
            "message": f"CloudWatch alarm '{alarm_name}': {new_state}. {reason}",
        }

    # Generic SNS notification
    if subject or message_str:
        return {
            "level": Severity.INFO,
            "service": "aws",
            "message": subject or message_str[:200],
        }

    return None


# ── Health Checker ───────────────────────────────────────────────────

class HealthChecker:
    """Periodic health checker for all BMO infrastructure.

    Checks GPU server, local Ollama, PeerJS signaling, and Pi system resources.
    Routes alerts via print logging, SocketIO events, OLED face, and Discord.

    Args:
        socketio: Flask-SocketIO instance for emitting alerts.
        check_interval: Seconds between health check cycles (default 60).
    """

    def __init__(self, socketio=None, check_interval: int = DEFAULT_CHECK_INTERVAL):
        self.socketio = socketio
        self.check_interval = check_interval
        self._running = False
        self._thread: threading.Thread | None = None

        # Current service status: service_name → {status, last_check, message, response_time}
        self._service_status: dict[str, dict] = {}

        # Previous status for detecting state transitions (recovery detection)
        self._prev_status: dict[str, str] = {}

        # Discord cooldown tracker: service_name → last_webhook_timestamp
        self._discord_cooldowns: dict[str, float] = {}

    # ── Lifecycle ────────────────────────────────────────────────────

    def start(self):
        """Start the background health check daemon thread."""
        if self._running:
            print("[monitor] Already running")
            return

        self._running = True
        self._thread = threading.Thread(target=self._check_loop, daemon=True)
        self._thread.start()
        print(f"[monitor] Health checker started (interval={self.check_interval}s)")

    def stop(self):
        """Stop the health check daemon."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        print("[monitor] Health checker stopped")

    # ── Main Check Loop ──────────────────────────────────────────────

    def _check_loop(self):
        """Background loop that runs health checks at the configured interval."""
        # Run first check immediately
        self.check_all()

        while self._running:
            time.sleep(self.check_interval)
            if not self._running:
                break
            try:
                self.check_all()
            except Exception as e:
                print(f"[monitor] Check loop error: {e}")

    def check_all(self):
        """Run all health checks and process results."""
        # Check HTTP services
        for service_name, config in HEALTH_CHECKS.items():
            self._check_http_service(service_name, config)

        # Check Pi system resources
        self._check_pi_resources()

        # Detect state transitions and emit recovery events
        self._process_state_transitions()

        # Update previous status snapshot
        for name, info in self._service_status.items():
            self._prev_status[name] = info.get("status", "unknown")

    # ── HTTP Service Checks ──────────────────────────────────────────

    def _check_http_service(self, name: str, config: dict):
        """Check a single HTTP service endpoint."""
        if not REQUESTS_AVAILABLE:
            self._service_status[name] = {
                "status": "unknown",
                "last_check": time.time(),
                "message": "requests library not available",
                "response_time": None,
            }
            return

        url = config["url"]
        timeout = config.get("timeout", 5)

        try:
            start = time.monotonic()
            r = requests.get(url, timeout=timeout)
            elapsed = round(time.monotonic() - start, 3)

            if r.status_code == 200:
                # Check if GPU server is slow (degraded)
                if name == "gpu_server" and elapsed > 5.0:
                    self._service_status[name] = {
                        "status": "degraded",
                        "last_check": time.time(),
                        "message": f"Slow response ({elapsed}s)",
                        "response_time": elapsed,
                    }
                    self._emit_alert(
                        Severity.WARNING, name,
                        f"{name} responding slowly ({elapsed}s)",
                    )
                else:
                    self._service_status[name] = {
                        "status": "up",
                        "last_check": time.time(),
                        "message": "OK",
                        "response_time": elapsed,
                    }
            else:
                self._service_status[name] = {
                    "status": "down",
                    "last_check": time.time(),
                    "message": f"HTTP {r.status_code}",
                    "response_time": elapsed,
                }
                severity = (
                    Severity.CRITICAL if name == "gpu_server"
                    else Severity.WARNING
                )
                self._emit_alert(
                    severity, name,
                    f"{name} returned HTTP {r.status_code}",
                )

        except requests.exceptions.Timeout:
            self._service_status[name] = {
                "status": "down",
                "last_check": time.time(),
                "message": f"Timeout after {timeout}s",
                "response_time": None,
            }
            severity = (
                Severity.CRITICAL if name == "gpu_server"
                else Severity.WARNING
            )
            self._emit_alert(severity, name, f"{name} timed out after {timeout}s")

        except requests.exceptions.ConnectionError:
            self._service_status[name] = {
                "status": "down",
                "last_check": time.time(),
                "message": "Connection refused",
                "response_time": None,
            }
            severity = (
                Severity.CRITICAL if name == "gpu_server"
                else Severity.WARNING
            )
            self._emit_alert(severity, name, f"{name} connection refused")

        except Exception as e:
            self._service_status[name] = {
                "status": "down",
                "last_check": time.time(),
                "message": str(e),
                "response_time": None,
            }
            self._emit_alert(Severity.WARNING, name, f"{name} check failed: {e}")

    # ── Pi Resource Checks ───────────────────────────────────────────

    def _check_pi_resources(self):
        """Check Pi system resources and emit alerts for thresholds."""
        stats = get_pi_stats()
        now = time.time()

        # Store as a pseudo-service for status reporting
        self._service_status["pi_resources"] = {
            "status": "up",
            "last_check": now,
            "message": "OK",
            "stats": stats,
        }

        # CPU temperature thresholds
        temp = stats.get("cpu_temp")
        if temp is not None:
            if temp > 80.0:
                self._service_status["pi_resources"]["status"] = "degraded"
                self._emit_alert(
                    Severity.CRITICAL, "pi_resources",
                    f"CPU temperature critical: {temp}C",
                )
            elif temp > 70.0:
                self._emit_alert(
                    Severity.WARNING, "pi_resources",
                    f"CPU temperature elevated: {temp}C",
                )

        # RAM usage thresholds
        ram = stats.get("ram_percent")
        if ram is not None and ram > 85.0:
            self._service_status["pi_resources"]["status"] = "degraded"
            self._emit_alert(
                Severity.WARNING, "pi_resources",
                f"RAM usage high: {ram}%",
            )

        # Disk usage thresholds
        disk = stats.get("disk_percent")
        if disk is not None:
            if disk > 95.0:
                self._service_status["pi_resources"]["status"] = "degraded"
                self._emit_alert(
                    Severity.CRITICAL, "pi_resources",
                    f"Disk usage critical: {disk}%",
                )
            elif disk > 85.0:
                self._emit_alert(
                    Severity.WARNING, "pi_resources",
                    f"Disk usage high: {disk}%",
                )

    # ── State Transition Detection ───────────────────────────────────

    def _process_state_transitions(self):
        """Detect recovery events — service went from down/degraded to up."""
        for name, info in self._service_status.items():
            current = info.get("status", "unknown")
            previous = self._prev_status.get(name, "unknown")

            # Recovery: was down or degraded, now up
            if previous in ("down", "degraded") and current == "up":
                print(f"[monitor] RECOVERY: {name} is back up")

                if self.socketio:
                    self.socketio.emit("alert", {
                        "level": "info",
                        "service": name,
                        "message": f"{name} has recovered",
                        "recovery": True,
                    })
                    # Reset OLED face back to normal if it was in error state
                    self.socketio.emit("bmo_status", {"expression": "idle"})

    # ── Alert Emission ───────────────────────────────────────────────

    def _emit_alert(self, level: Severity, service: str, message: str):
        """Route an alert to all configured destinations.

        Routing rules:
        - All alerts: print log with [monitor] prefix
        - Critical + Warning: SocketIO 'alert' event
        - Critical: OLED face expression change (bmo_status: error)
        - Critical: Discord webhook (with 5-min cooldown per service)
        - When service recovers: handled by _process_state_transitions
        """
        # Always log
        prefix = level.value.upper()
        print(f"[monitor] [{prefix}] {service}: {message}")

        # SocketIO for critical and warning
        if level in (Severity.CRITICAL, Severity.WARNING) and self.socketio:
            self.socketio.emit("alert", {
                "level": level.value,
                "service": service,
                "message": message,
            })

        # OLED face change for critical
        if level == Severity.CRITICAL and self.socketio:
            self.socketio.emit("bmo_status", {"expression": "error"})

        # Discord webhook for critical (with cooldown)
        if level == Severity.CRITICAL:
            self._send_discord_if_allowed(service, message)

    def _send_discord_if_allowed(self, service: str, message: str):
        """Send Discord webhook if cooldown has elapsed for this service."""
        now = time.time()
        last_sent = self._discord_cooldowns.get(service, 0)

        if now - last_sent < DISCORD_COOLDOWN:
            return  # Still in cooldown

        if _send_discord_webhook(Severity.CRITICAL, service, message):
            self._discord_cooldowns[service] = now

    # ── Status Summary ───────────────────────────────────────────────

    def get_status(self) -> dict:
        """Return current status of all services plus Pi stats.

        Returns:
            Dict with per-service status (up/down/degraded), Pi resource stats,
            and overall health summary.

        Used by the web UI status bar.
        """
        services = {}
        for name, info in self._service_status.items():
            services[name] = {
                "status": info.get("status", "unknown"),
                "last_check": info.get("last_check"),
                "message": info.get("message", ""),
                "response_time": info.get("response_time"),
            }

        pi_stats = get_pi_stats()

        # Overall health: critical if any service is down, warning if degraded
        overall = "healthy"
        for info in self._service_status.values():
            status = info.get("status", "unknown")
            if status == "down":
                overall = "critical"
                break
            if status == "degraded":
                overall = "warning"

        return {
            "overall": overall,
            "services": services,
            "pi_stats": pi_stats,
            "check_interval": self.check_interval,
        }

    # ── Manual Alert Injection ───────────────────────────────────────

    def inject_alert(self, level: Severity, service: str, message: str):
        """Manually inject an alert into the system (e.g., from SNS handler).

        Args:
            level: Severity level (info/warning/critical).
            service: Service name that triggered the alert.
            message: Human-readable alert message.
        """
        self._emit_alert(level, service, message)

        # Also update service status
        status = "down" if level == Severity.CRITICAL else "degraded"
        self._service_status[service] = {
            "status": status,
            "last_check": time.time(),
            "message": message,
            "response_time": None,
        }
