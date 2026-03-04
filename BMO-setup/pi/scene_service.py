"""Scene mode engine for BMO.

Manages scene activation/deactivation with state save/restore.
Built-in scenes: anime, bedtime, movie, party.
"""

import json
import os
import threading
import time

SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "data", "settings.json")

SCENES = {
    "anime": {
        "label": "🎌 Anime Mode",
        "rgb_off": True,
        "tv_app": "crunchyroll",
        "tv_on": True,
        "music_stop": True,
    },
    "bedtime": {
        "label": "🌙 Bedtime",
        "rgb_off": True,
        "tv_off": True,
        "music_stop": True,
    },
    "movie": {
        "label": "🎬 Movie Mode",
        "rgb_off": True,
        "tv_app": "plex",
        "tv_on": True,
        "music_stop": True,
    },
    "party": {
        "label": "🎉 Party Mode",
        "rgb_mode": "rainbow",
        "rgb_brightness": 255,
        "tv_off": True,
        "music_playlist": "party",
    },
}


class SceneService:
    """Manages scene activation with state save/restore."""

    def __init__(self, services: dict, socketio=None):
        self._services = services
        self._socketio = socketio
        self._lock = threading.Lock()
        self._active_scene: str | None = None
        self._saved_state: dict = {}
        self._load_state()

    # ── Public API ──────────────────────────────────────────────────

    def list_scenes(self) -> list[dict]:
        """List all available scenes with active status."""
        result = []
        for name, config in SCENES.items():
            result.append({
                "name": name,
                "label": config["label"],
                "active": self._active_scene == name,
            })
        return result

    def get_active(self) -> str | None:
        """Get the currently active scene name, or None."""
        return self._active_scene

    def activate(self, scene_name: str) -> tuple[bool, str]:
        """Activate a scene. Saves current state first."""
        scene_name = scene_name.lower().strip()
        if scene_name not in SCENES:
            return False, f"Unknown scene: {scene_name}. Available: {', '.join(SCENES.keys())}"

        with self._lock:
            # If already in a scene, deactivate first (don't overwrite saved state)
            if self._active_scene and self._active_scene != scene_name:
                self._apply_deactivation(skip_restore=True)

            # Save current state before applying scene (only if not already in a scene)
            if not self._active_scene:
                self._saved_state = self._capture_state()

            self._active_scene = scene_name
            self._save_state()

        # Apply scene settings
        scene = SCENES[scene_name]
        self._apply_scene(scene)

        if self._socketio:
            self._socketio.emit("scene_change", {"scene": scene_name, "active": True})

        return True, f"{scene['label']} activated"

    def deactivate(self) -> tuple[bool, str]:
        """Deactivate current scene and restore previous state."""
        with self._lock:
            if not self._active_scene:
                return False, "No scene is active"
            scene_name = self._active_scene
            label = SCENES.get(scene_name, {}).get("label", scene_name)

        self._apply_deactivation(skip_restore=False)

        if self._socketio:
            self._socketio.emit("scene_change", {"scene": None, "active": False})

        return True, f"{label} deactivated — restored previous state"

    def get_status(self) -> dict:
        """Get full scene status for API."""
        return {
            "active": self._active_scene,
            "label": SCENES.get(self._active_scene, {}).get("label") if self._active_scene else None,
            "scenes": self.list_scenes(),
        }

    # ── State Capture & Restore ─────────────────────────────────────

    def _capture_state(self) -> dict:
        """Capture current RGB, TV, music state for later restore."""
        state = {}

        # LED state
        led = self._services.get("leds")
        if led:
            try:
                state["led"] = {
                    "mode": getattr(led, "_custom_mode", 1),
                    "color": getattr(led, "_custom_color", (0, 255, 200)),
                    "brightness": getattr(led, "_brightness", 128),
                }
            except Exception:
                pass

        # Music state
        music = self._services.get("music")
        if music:
            try:
                state["music"] = {
                    "playing": getattr(music, "_playing", False),
                }
            except Exception:
                pass

        print(f"[scene] Captured state: {list(state.keys())}")
        return state

    def _restore_state(self):
        """Restore previously saved state."""
        if not self._saved_state:
            print("[scene] No saved state to restore")
            return

        # Restore LED
        led_state = self._saved_state.get("led")
        led = self._services.get("leds")
        if led_state and led:
            try:
                color = led_state.get("color", (0, 255, 200))
                if isinstance(color, list):
                    color = tuple(color)
                led.set_color(*color)
                brightness = led_state.get("brightness", 128)
                led.set_brightness(brightness)
                mode = led_state.get("mode", 1)
                mode_names = {0: "off", 1: "static", 2: "chase", 3: "breathing", 4: "rainbow"}
                led.set_mode(mode_names.get(mode, "static"))
                print(f"[scene] Restored LED: mode={mode}, color={color}, brightness={brightness}")
            except Exception as e:
                print(f"[scene] LED restore failed: {e}")

        self._saved_state = {}
        print("[scene] State restored")

    # ── Scene Application ───────────────────────────────────────────

    def _apply_scene(self, scene: dict):
        """Apply scene settings to hardware."""
        import requests as _req

        base = "http://localhost:5000"

        # RGB
        if scene.get("rgb_off"):
            try:
                _req.post(f"{base}/api/led/mode", json={"mode": "off"}, timeout=3)
                print("[scene] LED off")
            except Exception as e:
                print(f"[scene] LED off failed: {e}")
        elif scene.get("rgb_mode"):
            try:
                _req.post(f"{base}/api/led/mode", json={"mode": scene["rgb_mode"]}, timeout=3)
                if scene.get("rgb_brightness"):
                    _req.post(f"{base}/api/led/brightness", json={"brightness": scene["rgb_brightness"]}, timeout=3)
                print(f"[scene] LED {scene['rgb_mode']}")
            except Exception as e:
                print(f"[scene] LED mode failed: {e}")

        # TV
        if scene.get("tv_off"):
            try:
                _req.post(f"{base}/api/tv/power", json={"state": "off"}, timeout=5)
                print("[scene] TV off")
            except Exception as e:
                print(f"[scene] TV off failed: {e}")
        elif scene.get("tv_on"):
            try:
                _req.post(f"{base}/api/tv/power", json={"state": "on"}, timeout=5)
                time.sleep(2)
                if scene.get("tv_app"):
                    _req.post(f"{base}/api/tv/launch", json={"app": scene["tv_app"]}, timeout=5)
                    print(f"[scene] TV → {scene['tv_app']}")
            except Exception as e:
                print(f"[scene] TV launch failed: {e}")

        # Music
        if scene.get("music_stop"):
            try:
                _req.post(f"{base}/api/music/pause", timeout=3)
                print("[scene] Music stopped")
            except Exception:
                pass
        elif scene.get("music_playlist"):
            try:
                _req.post(f"{base}/api/music/play", json={"query": f"{scene['music_playlist']} mix"}, timeout=10)
                print(f"[scene] Music → {scene['music_playlist']}")
            except Exception as e:
                print(f"[scene] Music play failed: {e}")

    def _apply_deactivation(self, skip_restore: bool = False):
        """Deactivate the current scene."""
        with self._lock:
            scene_name = self._active_scene
            self._active_scene = None
            self._save_state()

        if not skip_restore:
            self._restore_state()

        print(f"[scene] {scene_name} deactivated")

    # ── Persistence ─────────────────────────────────────────────────

    def _load_state(self):
        """Load active scene from settings.json (survives restarts mid-scene)."""
        try:
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
                scene_data = settings.get("scene", {})
                self._active_scene = scene_data.get("active")
                self._saved_state = scene_data.get("saved_state", {})
                if self._active_scene:
                    print(f"[scene] Restored active scene: {self._active_scene}")
        except Exception as e:
            print(f"[scene] Load state failed: {e}")

    def _save_state(self):
        """Save scene state to settings.json."""
        try:
            os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
            settings = {}
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
            settings["scene"] = {
                "active": self._active_scene,
                "saved_state": self._saved_state,
            }
            with open(SETTINGS_PATH, "w") as f:
                json.dump(settings, f, indent=2)
        except Exception as e:
            print(f"[scene] Save state failed: {e}")
