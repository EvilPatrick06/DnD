"""BMO LED Mood Controller — State-based RGB LED patterns.

Controls the Freenove expansion board RGB LEDs to reflect BMO's current state.
Synced with OLED face expressions via shared SocketIO events.
"""

import math
import os
import threading
import time
from enum import Enum

try:
    from rpi_ws281x import PixelStrip, Color
    LED_AVAILABLE = True
except ImportError:
    LED_AVAILABLE = False


# ── LED Strip Configuration ───────────────────────────────────────────

LED_COUNT = 8           # Number of LEDs on the Freenove expansion board
LED_PIN = 18            # GPIO pin (PWM)
LED_FREQ_HZ = 800000   # LED signal frequency
LED_DMA = 10            # DMA channel
LED_BRIGHTNESS = 80     # Default brightness (0-255)
LED_INVERT = False
LED_CHANNEL = 0

FPS = 30
FRAME_DELAY = 1.0 / FPS


class LedState(Enum):
    """LED mood states matching OLED face expressions."""
    READY = "ready"           # Slow green pulse
    LISTENING = "listening"   # Steady blue glow
    THINKING = "thinking"     # Rotating yellow chase
    SPEAKING = "speaking"     # Cyan pulse
    MUSIC = "music"           # Rainbow wave
    COMBAT = "combat"         # Red pulse
    ERROR = "error"           # Fast red flash
    ALARM = "alarm"           # Orange strobe
    OFF = "off"               # All LEDs off


# ── Color Definitions ─────────────────────────────────────────────────

COLORS = {
    "green": (0, 255, 0),
    "blue": (0, 0, 255),
    "yellow": (255, 200, 0),
    "cyan": (0, 255, 255),
    "red": (255, 0, 0),
    "orange": (255, 120, 0),
    "purple": (128, 0, 255),
    "white": (255, 255, 255),
    "off": (0, 0, 0),
}


class LedController:
    """State machine for RGB LED patterns synced with BMO's expression."""

    def __init__(self):
        self._strip = None
        self._state = LedState.READY
        self._running = False
        self._render_thread = None
        self._frame = 0
        self._brightness = LED_BRIGHTNESS

    def start(self):
        """Initialize LED strip and start the animation loop."""
        if not LED_AVAILABLE:
            print("[led] rpi_ws281x not available — running headless")
            return

        try:
            self._strip = PixelStrip(
                LED_COUNT, LED_PIN, LED_FREQ_HZ,
                LED_DMA, LED_INVERT, self._brightness, LED_CHANNEL
            )
            self._strip.begin()
        except Exception as e:
            print(f"[led] Failed to init LED strip: {e}")
            return

        self._running = True
        self._render_thread = threading.Thread(target=self._animation_loop, daemon=True)
        self._render_thread.start()
        print("[led] LED controller started")

    def stop(self):
        """Stop animation and turn off LEDs."""
        self._running = False
        if self._strip:
            self._set_all(0, 0, 0)
            self._strip.show()

    def set_state(self, state: str):
        """Change LED state. Accepts LedState enum value strings or color names."""
        try:
            self._state = LedState(state)
        except ValueError:
            # Try matching a color name directly
            if state in COLORS:
                self._state = LedState.READY  # Use ready pattern with custom color
            else:
                print(f"[led] Unknown LED state: {state}")
        self._frame = 0

    def set_brightness(self, brightness: int):
        """Set LED brightness (0-255)."""
        self._brightness = max(0, min(255, brightness))
        if self._strip:
            self._strip.setBrightness(self._brightness)

    @property
    def current_state(self) -> str:
        return self._state.value

    # ── Animation Loop ────────────────────────────────────────────────

    def _animation_loop(self):
        """Main render loop at 30 FPS."""
        while self._running:
            start = time.time()
            self._render_frame()
            self._frame += 1
            elapsed = time.time() - start
            time.sleep(max(0, FRAME_DELAY - elapsed))

    def _render_frame(self):
        """Render the current LED state pattern."""
        if not self._strip:
            return

        state = self._state

        if state == LedState.READY:
            self._pattern_pulse(*COLORS["green"], speed=0.5)
        elif state == LedState.LISTENING:
            self._pattern_steady(*COLORS["blue"])
        elif state == LedState.THINKING:
            self._pattern_chase(*COLORS["yellow"], speed=2.0)
        elif state == LedState.SPEAKING:
            self._pattern_pulse(*COLORS["cyan"], speed=2.0)
        elif state == LedState.MUSIC:
            self._pattern_rainbow(speed=1.0)
        elif state == LedState.COMBAT:
            self._pattern_pulse(*COLORS["red"], speed=1.5)
        elif state == LedState.ERROR:
            self._pattern_flash(*COLORS["red"], speed=4.0)
        elif state == LedState.ALARM:
            self._pattern_flash(*COLORS["orange"], speed=6.0)
        elif state == LedState.OFF:
            self._set_all(0, 0, 0)

        self._strip.show()

    # ── LED Patterns ──────────────────────────────────────────────────

    def _set_all(self, r: int, g: int, b: int):
        """Set all LEDs to the same color."""
        for i in range(LED_COUNT):
            self._strip.setPixelColor(i, Color(r, g, b))

    def _pattern_steady(self, r: int, g: int, b: int):
        """Constant color on all LEDs."""
        self._set_all(r, g, b)

    def _pattern_pulse(self, r: int, g: int, b: int, speed: float = 1.0):
        """Smooth pulsing brightness."""
        t = self._frame / FPS * speed
        brightness = (math.sin(t * math.pi) + 1) / 2  # 0.0 to 1.0
        br = int(r * brightness)
        bg = int(g * brightness)
        bb = int(b * brightness)
        self._set_all(br, bg, bb)

    def _pattern_chase(self, r: int, g: int, b: int, speed: float = 1.0):
        """Rotating chase pattern — one lit LED moves around."""
        pos = int(self._frame * speed / FPS * LED_COUNT) % LED_COUNT
        for i in range(LED_COUNT):
            if i == pos:
                self._strip.setPixelColor(i, Color(r, g, b))
            elif i == (pos - 1) % LED_COUNT:
                # Trail LED at half brightness
                self._strip.setPixelColor(i, Color(r // 3, g // 3, b // 3))
            else:
                self._strip.setPixelColor(i, Color(0, 0, 0))

    def _pattern_flash(self, r: int, g: int, b: int, speed: float = 4.0):
        """Fast on/off flashing."""
        t = self._frame / FPS * speed
        on = int(t) % 2 == 0
        if on:
            self._set_all(r, g, b)
        else:
            self._set_all(0, 0, 0)

    def _pattern_rainbow(self, speed: float = 1.0):
        """Rainbow wave across all LEDs."""
        t = self._frame / FPS * speed
        for i in range(LED_COUNT):
            hue = (t + i / LED_COUNT) % 1.0
            r, g, b = self._hsv_to_rgb(hue, 1.0, 1.0)
            self._strip.setPixelColor(i, Color(int(r * 255), int(g * 255), int(b * 255)))

    @staticmethod
    def _hsv_to_rgb(h: float, s: float, v: float) -> tuple[float, float, float]:
        """Convert HSV (0-1 range) to RGB (0-1 range)."""
        if s == 0:
            return v, v, v
        i = int(h * 6)
        f = h * 6 - i
        p = v * (1 - s)
        q = v * (1 - s * f)
        t = v * (1 - s * (1 - f))
        i %= 6
        if i == 0: return v, t, p
        if i == 1: return q, v, p
        if i == 2: return p, v, t
        if i == 3: return p, q, v
        if i == 4: return t, p, v
        return v, p, q


# ── Expression → LED State Mapping ────────────────────────────────────

EXPRESSION_TO_LED = {
    "idle": LedState.READY,
    "listening": LedState.LISTENING,
    "thinking": LedState.THINKING,
    "speaking": LedState.SPEAKING,
    "happy": LedState.MUSIC,
    "error": LedState.ERROR,
    "alert": LedState.ALARM,
    "combat": LedState.COMBAT,
    "sleeping": LedState.OFF,
}


def led_state_for_expression(expression: str) -> str:
    """Convert an OLED face expression to an LED state string."""
    state = EXPRESSION_TO_LED.get(expression, LedState.READY)
    return state.value
