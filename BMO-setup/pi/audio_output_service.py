"""Audio output routing service for BMO.

Uses PipeWire/WirePlumber (wpctl) for device enumeration and switching.
Supports per-function audio routing and Bluetooth device management.
"""

import json
import os
import re
import subprocess
import threading
import time

SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "data", "settings.json")

# Audio function categories that can be independently routed
AUDIO_FUNCTIONS = ["music", "voice", "effects", "notifications", "all"]


def _run(cmd: list[str], timeout: int = 10) -> tuple[int, str, str]:
    """Run a shell command, return (returncode, stdout, stderr)."""
    env = os.environ.copy()
    env["XDG_RUNTIME_DIR"] = "/run/user/1000"
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
        return r.returncode, r.stdout, r.stderr
    except Exception as e:
        return 1, "", str(e)


class AudioDevice:
    """Represents a PipeWire audio sink or source."""

    def __init__(self, pw_id: int, name: str, description: str, is_default: bool = False):
        self.pw_id = pw_id
        self.name = name
        self.description = description
        self.is_default = is_default

    def to_dict(self) -> dict:
        return {
            "id": self.pw_id,
            "name": self.name,
            "description": self.description,
            "is_default": self.is_default,
        }


class AudioOutputService:
    """Manages audio output routing via PipeWire/WirePlumber."""

    def __init__(self):
        self._lock = threading.Lock()
        # Per-function device assignments: function -> pw_id
        self._routing: dict[str, int | None] = {}
        self._load_routing()

    # ── Device Enumeration ──────────────────────────────────────────

    def list_sinks(self) -> list[AudioDevice]:
        """List active audio output devices (sinks only, no disconnected)."""
        rc, out, _ = _run(["wpctl", "status"])
        if rc != 0:
            return []
        return self._parse_sinks(out)

    def list_sources(self) -> list[AudioDevice]:
        """List active audio input devices (sources)."""
        rc, out, _ = _run(["wpctl", "status"])
        if rc != 0:
            return []
        return self._parse_sources(out)

    def _parse_sinks(self, wpctl_output: str) -> list[AudioDevice]:
        """Parse wpctl status output for active sinks."""
        return self._parse_section(wpctl_output, "Sinks:")

    def _parse_sources(self, wpctl_output: str) -> list[AudioDevice]:
        """Parse wpctl status output for active sources."""
        return self._parse_section(wpctl_output, "Sources:")

    def _parse_section(self, output: str, section_header: str) -> list[AudioDevice]:
        """Parse a section of wpctl status output for devices."""
        devices = []
        lines = output.split("\n")
        in_audio = False
        in_section = False

        for line in lines:
            stripped = line.strip()
            # Strip tree-drawing characters (│├└─ and spaces)
            clean = re.sub(r'^[│├└─\s]+', '', stripped)

            if clean.startswith("Audio"):
                in_audio = True
                continue
            if in_audio and clean.startswith("Video"):
                break
            if in_audio and clean == section_header:
                in_section = True
                continue
            if in_section:
                # End of section: next header like "Sources:", "Filters:", "Streams:"
                if clean and clean.endswith(":") and not any(c.isdigit() for c in clean.rstrip(":")):
                    in_section = False
                    continue
                # Empty or tree-only lines
                if not clean:
                    continue

                # Match: "*   78. Built-in Audio Digital Stereo (HDMI) [vol: 1.00]"
                #    or: "    79. Some Device [vol: 0.50]"
                match = re.match(r'(\*)?\s*(\d+)\.\s+(.+?)(?:\s+\[vol:.*\])?\s*$', clean)
                if match:
                    is_default = match.group(1) == "*"
                    pw_id = int(match.group(2))
                    desc = match.group(3).strip()
                    if desc.lower().startswith("default"):
                        continue
                    devices.append(AudioDevice(pw_id, f"sink_{pw_id}", desc, is_default))

        return devices

    def get_default_sink(self) -> AudioDevice | None:
        """Get the current default audio output device."""
        sinks = self.list_sinks()
        for s in sinks:
            if s.is_default:
                return s
        return sinks[0] if sinks else None

    # ── Output Switching ────────────────────────────────────────────

    def set_default_output(self, pw_id: int) -> bool:
        """Set the default audio output device for the whole system."""
        rc, _, err = _run(["wpctl", "set-default", str(pw_id)])
        if rc != 0:
            print(f"[audio] Failed to set default sink {pw_id}: {err}")
            return False
        print(f"[audio] Default output set to device {pw_id}")
        return True

    def set_function_output(self, function: str, pw_id: int) -> bool:
        """Route a specific function's audio to a device.

        For 'all', sets the system default which affects everything.
        For individual functions, stores the routing preference.
        The actual routing happens at playback time in each service.
        """
        if function == "all":
            success = self.set_default_output(pw_id)
            if success:
                with self._lock:
                    self._routing = {f: pw_id for f in AUDIO_FUNCTIONS if f != "all"}
                    self._save_routing()
            return success

        if function not in AUDIO_FUNCTIONS:
            print(f"[audio] Unknown function: {function}")
            return False

        with self._lock:
            self._routing[function] = pw_id
            self._save_routing()
        print(f"[audio] {function} routed to device {pw_id}")
        return True

    def get_function_output(self, function: str) -> int | None:
        """Get the device ID assigned to a function, or None for system default."""
        with self._lock:
            return self._routing.get(function)

    def get_all_routing(self) -> dict:
        """Get all function-to-device routing as a dict."""
        sinks = self.list_sinks()
        sink_map = {s.pw_id: s.to_dict() for s in sinks}
        default = self.get_default_sink()

        result = {}
        for func in AUDIO_FUNCTIONS:
            if func == "all":
                continue
            pw_id = self._routing.get(func)
            if pw_id and pw_id in sink_map:
                result[func] = sink_map[pw_id]
            elif default:
                result[func] = {**default.to_dict(), "is_default": True}
            else:
                result[func] = None
        return result

    # ── Bluetooth ───────────────────────────────────────────────────

    def bluetooth_scan(self, duration: int = 10) -> list[dict]:
        """Scan for Bluetooth audio devices. Returns list of {address, name}."""
        # Power on and start scan
        _run(["bluetoothctl", "power", "on"])
        _run(["bluetoothctl", "scan", "on"], timeout=2)
        time.sleep(min(duration, 15))
        _run(["bluetoothctl", "scan", "off"], timeout=2)

        # Get discovered devices
        rc, out, _ = _run(["bluetoothctl", "devices"])
        if rc != 0:
            return []

        devices = []
        for line in out.strip().split("\n"):
            match = re.match(r"Device\s+([0-9A-Fa-f:]+)\s+(.+)", line.strip())
            if match:
                devices.append({"address": match.group(1), "name": match.group(2)})
        return devices

    def bluetooth_pair(self, address: str) -> tuple[bool, str]:
        """Pair and connect to a Bluetooth device."""
        _run(["bluetoothctl", "power", "on"])

        rc, _, err = _run(["bluetoothctl", "pair", address], timeout=15)
        if rc != 0 and "already exists" not in err.lower():
            return False, f"Pair failed: {err}"

        rc, _, err = _run(["bluetoothctl", "trust", address], timeout=5)
        if rc != 0:
            return False, f"Trust failed: {err}"

        rc, _, err = _run(["bluetoothctl", "connect", address], timeout=15)
        if rc != 0:
            return False, f"Connect failed: {err}"

        return True, f"Connected to {address}"

    def bluetooth_disconnect(self, address: str) -> tuple[bool, str]:
        """Disconnect a Bluetooth device."""
        rc, _, err = _run(["bluetoothctl", "disconnect", address], timeout=5)
        if rc != 0:
            return False, f"Disconnect failed: {err}"
        return True, f"Disconnected {address}"

    def bluetooth_connected(self) -> list[dict]:
        """List currently connected Bluetooth devices."""
        rc, out, _ = _run(["bluetoothctl", "devices", "Connected"])
        if rc != 0:
            return []

        devices = []
        for line in out.strip().split("\n"):
            match = re.match(r"Device\s+([0-9A-Fa-f:]+)\s+(.+)", line.strip())
            if match:
                devices.append({"address": match.group(1), "name": match.group(2)})
        return devices

    # ── Persistence ─────────────────────────────────────────────────

    def _load_routing(self):
        """Load routing preferences from settings.json."""
        try:
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
                self._routing = settings.get("audio_routing", {})
                # Convert string keys to int values
                self._routing = {k: int(v) for k, v in self._routing.items() if v is not None}
        except Exception as e:
            print(f"[audio] Failed to load routing: {e}")
            self._routing = {}

    def _save_routing(self):
        """Save routing preferences to settings.json."""
        try:
            os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
            settings = {}
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
            settings["audio_routing"] = self._routing
            with open(SETTINGS_PATH, "w") as f:
                json.dump(settings, f, indent=2)
        except Exception as e:
            print(f"[audio] Failed to save routing: {e}")

    # ── Convenience ─────────────────────────────────────────────────

    def find_device_by_name(self, name: str) -> AudioDevice | None:
        """Find a sink by partial name match (case-insensitive)."""
        name_lower = name.lower()
        for sink in self.list_sinks():
            if name_lower in sink.description.lower():
                return sink
        return None

    def get_status(self) -> dict:
        """Get full audio status for API/voice responses."""
        return {
            "default": (d := self.get_default_sink()) and d.to_dict(),
            "sinks": [s.to_dict() for s in self.list_sinks()],
            "sources": [s.to_dict() for s in self.list_sources()],
            "routing": self.get_all_routing(),
            "bluetooth_connected": self.bluetooth_connected(),
        }
