"""BMO Monitoring & Alerting — Health checks, Pi stats, Discord webhooks.

Periodically checks the health of all BMO infrastructure components:
Cloud APIs, Cloudflare Tunnel, PeerJS signaling, local Ollama, Pi resources.
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

DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# API keys for cloud health checks
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")

# Health check targets: service name → config
HEALTH_CHECKS = {
    "ollama_local": {"url": "http://localhost:11434/api/tags", "timeout": 3},
    "peerjs": {"url": "http://localhost:9000/myapp", "timeout": 3},
    "bmo_app": {"url": "http://localhost:5000/health", "timeout": 3},
}

# Cloud API health checks (checked separately with auth headers)
CLOUD_HEALTH_CHECKS = {
    "gemini_api": {
        "url": f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}",
        "timeout": 5,
        "enabled": bool(GEMINI_API_KEY),
    },
    "groq_api": {
        "url": "https://api.groq.com/openai/v1/models",
        "timeout": 5,
        "headers": {"Authorization": f"Bearer {GROQ_API_KEY}"},
        "enabled": bool(GROQ_API_KEY),
    },
    "fish_audio_api": {
        "url": "https://api.fish.audio/model",
        "timeout": 5,
        "headers": {"Authorization": f"Bearer {FISH_AUDIO_API_KEY}"},
        "enabled": bool(FISH_AUDIO_API_KEY),
    },
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


# ── Health Checker ───────────────────────────────────────────────────

class HealthChecker:
    """Periodic health checker for all BMO infrastructure.

    Checks local Ollama, PeerJS signaling, and Pi system resources.
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
        # Load from disk so recovery alerts work across restarts
        self._state_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "data", "monitor_state.json"
        )
        self._prev_status: dict[str, str] = self._load_prev_status()

        # Discord cooldown tracker: service_name → last_webhook_timestamp
        self._discord_cooldowns: dict[str, float] = {}

    def _load_prev_status(self) -> dict[str, str]:
        """Load previous service status from disk (survives restarts)."""
        try:
            if os.path.exists(self._state_file):
                with open(self._state_file, "r") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[monitor] Could not load saved state: {e}")
        return {}

    def _save_prev_status(self):
        """Persist current service status to disk for recovery detection."""
        try:
            os.makedirs(os.path.dirname(self._state_file), exist_ok=True)
            with open(self._state_file, "w") as f:
                json.dump(self._prev_status, f)
        except Exception as e:
            print(f"[monitor] Could not save state: {e}")

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
        # Check local HTTP services
        for service_name, config in HEALTH_CHECKS.items():
            self._check_http_service(service_name, config)

        # Check cloud API services
        for service_name, config in CLOUD_HEALTH_CHECKS.items():
            if config.get("enabled", False):
                self._check_http_service(service_name, config)

        # Check Docker containers
        self._check_docker_containers()

        # Check internet connectivity
        self._check_internet()

        # Check Pi system resources (CPU, RAM, disk)
        self._check_pi_resources()

        # Check Pi power supply / throttle status
        self._check_pi_power()

        # Detect state transitions and emit recovery events
        self._process_state_transitions()

        # Update previous status snapshot and persist to disk
        for name, info in self._service_status.items():
            self._prev_status[name] = info.get("status", "unknown")
        self._save_prev_status()

    # ── HTTP Service Checks ──────────────────────────────────────────

    # Human-readable names for Discord/log messages
    _SERVICE_LABELS = {
        "ollama_local": "🤖 Ollama (local LLM fallback)",
        "peerjs": "🌐 PeerJS (D&D multiplayer signaling)",
        "pihole": "🛡️ Pi-hole (ad blocker DNS)",
        "bmo_app": "🏠 BMO Flask App (web UI + API)",
        "gemini_api": "☁️ Gemini API (primary LLM)",
        "groq_api": "☁️ Groq API (speech-to-text)",
        "fish_audio_api": "🔊 Fish Audio API (text-to-speech)",
    }

    def _service_label(self, name: str) -> str:
        if name in self._SERVICE_LABELS:
            return self._SERVICE_LABELS[name]
        # Auto-generate friendly label for docker containers
        if name.startswith("docker_"):
            container = name[7:]  # strip "docker_"
            return f"🐳 {container}"
        return name

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
        label = self._service_label(name)

        try:
            start = time.monotonic()
            headers = config.get("headers", {})
            r = requests.get(url, timeout=timeout, headers=headers)
            elapsed = round(time.monotonic() - start, 3)

            if r.status_code == 200:
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
                self._emit_alert(
                    Severity.WARNING, name,
                    f"{label} returned HTTP {r.status_code}",
                )

        except requests.exceptions.Timeout:
            self._service_status[name] = {
                "status": "down",
                "last_check": time.time(),
                "message": f"Timeout after {timeout}s",
                "response_time": None,
            }
            self._emit_alert(
                Severity.CRITICAL, name,
                f"{label} is not responding (timed out after {timeout}s)",
            )

        except requests.exceptions.ConnectionError:
            self._service_status[name] = {
                "status": "down",
                "last_check": time.time(),
                "message": "Connection refused",
                "response_time": None,
            }
            self._emit_alert(
                Severity.CRITICAL, name,
                f"{label} is DOWN — connection refused. Service may have crashed.",
            )

        except Exception as e:
            self._service_status[name] = {
                "status": "down",
                "last_check": time.time(),
                "message": str(e),
                "response_time": None,
            }
            self._emit_alert(Severity.WARNING, name, f"{label} check failed: {e}")

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
                    Severity.CRITICAL, "pi_cpu_temp",
                    f"🌡️ CPU temperature critical: {temp}°C — risk of thermal throttling",
                )
            elif temp > 70.0:
                self._emit_alert(
                    Severity.WARNING, "pi_cpu_temp",
                    f"🌡️ CPU temperature elevated: {temp}°C",
                )

        # RAM usage thresholds
        ram = stats.get("ram_percent")
        if ram is not None and ram > 85.0:
            self._service_status["pi_resources"]["status"] = "degraded"
            self._emit_alert(
                Severity.WARNING, "pi_ram",
                f"🧠 RAM usage high: {ram}% — may cause OOM kills",
            )

        # Disk usage thresholds
        disk = stats.get("disk_percent")
        if disk is not None:
            if disk > 95.0:
                self._service_status["pi_resources"]["status"] = "degraded"
                self._emit_alert(
                    Severity.CRITICAL, "pi_disk",
                    f"💾 Disk usage critical: {disk}% — BMO may stop writing data",
                )
            elif disk > 85.0:
                self._emit_alert(
                    Severity.WARNING, "pi_disk",
                    f"💾 Disk usage high: {disk}%",
                )

    # ── Docker Container Checks ──────────────────────────────────────

    def _check_docker_containers(self):
        """Check ALL Docker container status via auto-discovery."""
        import subprocess

        # Auto-discover all containers (running and stopped)
        try:
            result = subprocess.run(
                ["docker", "ps", "-a", "--format", "{{.Names}}"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode != 0:
                print(f"[monitor] Docker ps failed: {result.stderr.strip()}")
                return
            containers = [n.strip() for n in result.stdout.strip().split("\n") if n.strip()]
        except Exception as e:
            print(f"[monitor] Docker discovery failed: {e}")
            return

        if not containers:
            return

        for name in containers:
            try:
                result = subprocess.run(
                    ["docker", "inspect", "--format",
                     '{"running":{{.State.Running}},"status":"{{.State.Status}}","restarts":{{.RestartCount}}}',
                     name],
                    capture_output=True, text=True, timeout=5,
                )
                if result.returncode != 0:
                    self._service_status[f"docker_{name}"] = {
                        "status": "down",
                        "last_check": time.time(),
                        "message": f"Container not found",
                        "response_time": None,
                    }
                    self._emit_alert(
                        Severity.CRITICAL, f"docker_{name}",
                        f"🐳 Docker container '{name}' not found — run: docker compose up -d",
                    )
                    continue

                info = json.loads(result.stdout.strip())
                if info.get("running"):
                    status_msg = f"Running (restarts: {info.get('restarts', 0)})"
                    self._service_status[f"docker_{name}"] = {
                        "status": "up",
                        "last_check": time.time(),
                        "message": status_msg,
                        "response_time": None,
                    }
                    restarts = info.get("restarts", 0)
                    if restarts > 5:
                        self._emit_alert(
                            Severity.WARNING, f"docker_{name}",
                            f"🐳 Container '{name}' has restarted {restarts} times — check logs: docker logs {name}",
                        )
                else:
                    state = info.get("status", "unknown")
                    self._service_status[f"docker_{name}"] = {
                        "status": "down",
                        "last_check": time.time(),
                        "message": f"State: {state}",
                        "response_time": None,
                    }
                    self._emit_alert(
                        Severity.CRITICAL, f"docker_{name}",
                        f"🐳 Docker container '{name}' is {state} — run: docker start {name}",
                    )
            except subprocess.TimeoutExpired:
                self._service_status[f"docker_{name}"] = {
                    "status": "unknown",
                    "last_check": time.time(),
                    "message": "Docker inspect timed out",
                    "response_time": None,
                }
            except Exception as e:
                self._service_status[f"docker_{name}"] = {
                    "status": "unknown",
                    "last_check": time.time(),
                    "message": str(e),
                    "response_time": None,
                }

    # ── Internet Connectivity Check ──────────────────────────────────

    def _check_internet(self):
        """Check internet connectivity by pinging reliable endpoints."""
        targets = [
            ("dns_google", "https://dns.google/resolve?name=google.com&type=A"),
            ("cloudflare", "https://1.1.1.1/cdn-cgi/trace"),
        ]

        any_reachable = False
        for name, url in targets:
            if not REQUESTS_AVAILABLE:
                break
            try:
                start = time.monotonic()
                r = requests.get(url, timeout=5)
                elapsed = round(time.monotonic() - start, 3)
                if r.status_code == 200:
                    any_reachable = True
                    break
            except Exception:
                pass

        now = time.time()
        if any_reachable:
            self._service_status["internet"] = {
                "status": "up",
                "last_check": now,
                "message": "OK",
                "response_time": elapsed,
            }
        else:
            self._service_status["internet"] = {
                "status": "down",
                "last_check": now,
                "message": "No internet — all cloud APIs will fail",
                "response_time": None,
            }
            self._emit_alert(
                Severity.CRITICAL, "internet",
                "🌐 Internet is DOWN — cloud LLMs, STT, TTS, Calendar, Vision all offline. "
                "BMO will fall back to local Ollama.",
            )

    # ── Pi Power / Throttle Check ────────────────────────────────────

    def _check_pi_power(self):
        """Check Pi voltage/throttle flags via vcgencmd or /sys."""
        import subprocess

        now = time.time()
        throttle_flags = None

        try:
            result = subprocess.run(
                ["vcgencmd", "get_throttled"],
                capture_output=True, text=True, timeout=3,
            )
            if result.returncode == 0:
                # Output: throttled=0x50000 (or similar hex)
                val = result.stdout.strip().split("=")[-1]
                throttle_flags = int(val, 16)
        except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
            pass

        if throttle_flags is None:
            # Try sysfs fallback
            try:
                with open("/sys/devices/platform/soc/soc:firmware/get_throttled") as f:
                    throttle_flags = int(f.read().strip(), 16)
            except (FileNotFoundError, ValueError, PermissionError):
                self._service_status["pi_power"] = {
                    "status": "unknown",
                    "last_check": now,
                    "message": "Cannot read throttle status",
                    "response_time": None,
                }
                return

        # Decode throttle flags (bits):
        # 0: under-voltage detected
        # 1: arm frequency capped
        # 2: currently throttled
        # 3: soft temperature limit active
        # 16: under-voltage has occurred since boot
        # 17: arm frequency capped has occurred
        # 18: throttling has occurred
        # 19: soft temperature limit has occurred

        issues = []
        if throttle_flags & 0x1:
            issues.append("⚡ UNDER-VOLTAGE NOW — power supply too weak")
        if throttle_flags & 0x4:
            issues.append("🔥 THROTTLED NOW — CPU frequency reduced")
        if throttle_flags & 0x2:
            issues.append("⚠️ ARM frequency capped NOW")
        if throttle_flags & 0x8:
            issues.append("🌡️ Soft temperature limit active NOW")

        historical = []
        if throttle_flags & 0x10000:
            historical.append("under-voltage since boot")
        if throttle_flags & 0x40000:
            historical.append("throttled since boot")

        if issues:
            self._service_status["pi_power"] = {
                "status": "degraded",
                "last_check": now,
                "message": "; ".join(issues),
                "throttle_flags": hex(throttle_flags),
            }
            self._emit_alert(
                Severity.CRITICAL, "pi_power",
                " | ".join(issues) + (f" (flags: {hex(throttle_flags)})" if historical else ""),
            )
        else:
            msg = "OK"
            if historical:
                msg = f"OK now (past issues: {', '.join(historical)})"
            self._service_status["pi_power"] = {
                "status": "up",
                "last_check": now,
                "message": msg,
                "throttle_flags": hex(throttle_flags),
            }

    # ── State Transition Detection ───────────────────────────────────

    def _process_state_transitions(self):
        """Detect recovery events — service went from down/degraded to up."""
        for name, info in self._service_status.items():
            current = info.get("status", "unknown")
            previous = self._prev_status.get(name, "unknown")

            # Recovery: was down or degraded, now up
            if previous in ("down", "degraded") and current == "up":
                label = self._service_label(name)
                recovery_msg = f"✅ {label} has recovered and is back online"
                print(f"[monitor] RECOVERY: {name} is back up")

                # Discord recovery notification (bypass cooldown)
                _send_discord_webhook(Severity.INFO, name, recovery_msg)

                if self.socketio:
                    self.socketio.emit("alert", {
                        "level": "info",
                        "service": name,
                        "message": recovery_msg,
                        "recovery": True,
                    })
                    self.socketio.emit("bmo_status", {"expression": "idle"})

    # ── Alert Emission ───────────────────────────────────────────────

    def _emit_alert(self, level: Severity, service: str, message: str):
        """Route an alert to all configured destinations.

        Routing rules:
        - All alerts: print log with [monitor] prefix
        - Critical + Warning: SocketIO 'alert' event + Discord webhook
        - Critical: OLED face expression change (bmo_status: error)
        - Discord webhook uses 5-min cooldown per service
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

        # Discord webhook for critical AND warning (with cooldown)
        if level in (Severity.CRITICAL, Severity.WARNING):
            self._send_discord_if_allowed(level, service, message)

    def _send_discord_if_allowed(self, level: Severity, service: str, message: str):
        """Send Discord webhook if cooldown has elapsed for this service."""
        now = time.time()
        last_sent = self._discord_cooldowns.get(service, 0)

        if now - last_sent < DISCORD_COOLDOWN:
            return  # Still in cooldown

        if _send_discord_webhook(level, service, message):
            self._discord_cooldowns[service] = now

    # ── Status Summary ───────────────────────────────────────────────

    def get_status(self) -> dict:
        """Return current status of all services plus Pi stats.

        Returns:
            Dict with per-service status (up/down/degraded), Pi resource stats,
            Docker container status, internet status, power status,
            and overall health summary.

        Used by the web UI status bar and /api/health/full endpoint.
        """
        services = {}
        for name, info in self._service_status.items():
            entry = {
                "status": info.get("status", "unknown"),
                "last_check": info.get("last_check"),
                "message": info.get("message", ""),
                "response_time": info.get("response_time"),
            }
            # Include extra fields if present
            if "stats" in info:
                entry["stats"] = info["stats"]
            if "throttle_flags" in info:
                entry["throttle_flags"] = info["throttle_flags"]
            services[name] = entry

        pi_stats = get_pi_stats()

        # Overall health: critical if any service is down, warning if degraded
        overall = "healthy"
        down_services = []
        degraded_services = []
        for name, info in self._service_status.items():
            status = info.get("status", "unknown")
            if status == "down":
                down_services.append(name)
            elif status == "degraded":
                degraded_services.append(name)

        if down_services:
            overall = "critical"
        elif degraded_services:
            overall = "warning"

        return {
            "overall": overall,
            "down_services": down_services,
            "degraded_services": degraded_services,
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
