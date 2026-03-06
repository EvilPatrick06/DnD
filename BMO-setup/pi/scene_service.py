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
        self._lock = threading.RLock()
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
                # _custom_mode is None when BMO controls LEDs (state-based), use _state
                mode = getattr(led, "_custom_mode", None)
                if mode is None:
                    # Map led state to a mode number
                    from led_controller import STATE_CONFIG, MODE_OFF
                    led_state = getattr(led, "_state", None)
                    mode = STATE_CONFIG.get(led_state, (MODE_OFF, None))[0] if led_state else MODE_OFF
                state["led"] = {
                    "mode": mode,
                    "color": getattr(led, "_custom_color", None),
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
                mode = led_state.get("mode", 0)
                mode_names = {0: "off", 1: "static", 2: "chase", 3: "breathing", 4: "rainbow"}
                mode_name = mode_names.get(mode, "off")

                if mode == 0:
                    # Just turn off, don't set color (avoids flash)
                    led.set_mode("off")
                else:
                    # Set mode first, then color+brightness
                    led.set_mode(mode_name)
                    color = led_state.get("color")
                    if color:
                        if isinstance(color, list):
                            color = tuple(color)
                        led.set_color(*color)
                    brightness = led_state.get("brightness", 128)
                    led.set_brightness(brightness)
                print(f"[scene] Restored LED: mode={mode_name}, color={led_state.get('color')}, brightness={led_state.get('brightness')}")
            except Exception as e:
                print(f"[scene] LED restore failed: {e}")

        self._saved_state = {}
        print("[scene] State restored")

    # ── Scene Application ───────────────────────────────────────────

    def _apply_scene(self, scene: dict):
        """Apply scene settings to hardware via service objects (no HTTP)."""
        print(f"[scene] Applying scene settings: {scene}")
        led = self._services.get("leds")
        music = self._services.get("music")
        tv_send_key = self._services.get("tv_send_key")
        tv_launch = self._services.get("tv_launch")

        # RGB
        if scene.get("rgb_off"):
            try:
                if led:
                    led.set_mode("off")
                print("[scene] LED off")
            except Exception as e:
                print(f"[scene] LED off failed: {e}")
        elif scene.get("rgb_mode"):
            try:
                if led:
                    led.set_mode(scene["rgb_mode"])
                    if scene.get("rgb_brightness"):
                        led.set_brightness(scene["rgb_brightness"])
                print(f"[scene] LED {scene['rgb_mode']}")
            except Exception as e:
                print(f"[scene] LED mode failed: {e}")

        # TV
        tv_power_on = self._services.get("tv_power_on")
        tv_power_off = self._services.get("tv_power_off")
        if scene.get("tv_off"):
            try:
                if not tv_power_off:
                    print("[scene] TV power_off callback not available")
                    if self._socketio:
                        self._socketio.emit("notification", {"message": "TV not connected — pair in TV tab first", "type": "warning"})
                else:
                    tv_power_off()
            except Exception as e:
                print(f"[scene] TV off failed: {e}")
        elif scene.get("tv_on"):
            try:
                if not tv_power_on:
                    print("[scene] TV power_on callback not available")
                    if self._socketio:
                        self._socketio.emit("notification", {"message": "TV not connected — pair in TV tab first", "type": "warning"})
                else:
                    tv_power_on()
                    time.sleep(3)
                    if scene.get("tv_app") and tv_launch:
                        tv_launch(scene["tv_app"])
                        print(f"[scene] TV → {scene['tv_app']}")
            except Exception as e:
                print(f"[scene] TV launch failed: {e}")

        # Music
        if scene.get("music_stop"):
            try:
                if music and hasattr(music, "stop"):
                    music.stop()
                print("[scene] Music stopped")
            except Exception:
                pass
        elif scene.get("music_playlist"):
            try:
                if music and hasattr(music, "search"):
                    results = music.search(f"{scene['music_playlist']} mix", limit=1)
                    if results:
                        music.play(results[0])
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
