"""BMO LED Mood Controller — State-based RGB LED patterns.

Controls the Freenove expansion board RGB LEDs via I2C (address 0x21).
Uses smbus2 for Pi 5 compatibility.

Board LED modes (register 0x03):
  0 = Off
  1 = Static (fixed color)
  2 = Follow (sequential chase)
  3 = Breathing (pulse)
  4 = Rainbow (auto cycle)
"""

import threading
import time
from enum import Enum

try:
    from smbus2 import SMBus
    LED_AVAILABLE = True
except ImportError:
    LED_AVAILABLE = False

# ── Freenove Expansion Board I2C Registers ────────────────────────────

I2C_BUS = 1
I2C_ADDR = 0x21
REG_LED_SPECIFIED = 0x01   # Set single LED: [id, r, g, b]
REG_LED_ALL = 0x02         # Set all LEDs: [r, g, b]
REG_LED_MODE = 0x03        # 0=Off, 1=Static, 2=Follow, 3=Breathing, 4=Rainbow

# Board LED mode constants
MODE_OFF = 0
MODE_STATIC = 1
MODE_FOLLOW = 2
MODE_BREATHING = 3
MODE_RAINBOW = 4


class LedState(Enum):
    """LED mood states matching OLED face expressions."""
    READY = "ready"           # Green breathing
    LISTENING = "listening"   # Blue static
    THINKING = "thinking"     # Yellow follow/chase
    SPEAKING = "speaking"     # Cyan breathing
    MUSIC = "music"           # Rainbow
    COMBAT = "combat"         # Red breathing
    ERROR = "error"           # Red static (flash via thread)
    ALARM = "alarm"           # Orange static (flash via thread)
    OFF = "off"               # Off


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

# State → (board_mode, color)
STATE_CONFIG = {
    LedState.READY:     (MODE_BREATHING, "green"),
    LedState.LISTENING: (MODE_STATIC,    "blue"),
    LedState.THINKING:  (MODE_FOLLOW,    "yellow"),
    LedState.SPEAKING:  (MODE_BREATHING, "cyan"),
    LedState.MUSIC:     (MODE_RAINBOW,   None),
    LedState.COMBAT:    (MODE_BREATHING, "red"),
    LedState.ERROR:     (MODE_STATIC,    "red"),
    LedState.ALARM:     (MODE_STATIC,    "orange"),
    LedState.OFF:       (MODE_OFF,       None),
}


class LedController:
    """State machine for RGB LED patterns via Freenove I2C expansion board."""

    def __init__(self):
        self._bus = None
        self._state = LedState.READY
        self._flash_thread = None
        self._flash_stop = threading.Event()

    def start(self):
        """Initialize I2C bus and set initial state."""
        if not LED_AVAILABLE:
            print("[led] smbus2 not available — running headless")
            return

        try:
            self._bus = SMBus(I2C_BUS)
            self._apply_state()
            print("[led] LED controller started (I2C 0x{:02X})".format(I2C_ADDR))
        except Exception as e:
            print(f"[led] Failed to init I2C bus: {e}")

    def stop(self):
        """Turn off LEDs."""
        self._stop_flash()
        self._set_mode(MODE_OFF)
        if self._bus:
            self._bus.close()
            self._bus = None

    def set_state(self, state: str):
        """Change LED state."""
        try:
            self._state = LedState(state)
        except ValueError:
            if state in COLORS:
                self._state = LedState.READY
            else:
                print(f"[led] Unknown LED state: {state}")
                return
        self._apply_state()

    @property
    def current_state(self) -> str:
        return self._state.value

    def _apply_state(self):
        """Apply the current state to the board."""
        self._stop_flash()
        mode, color_name = STATE_CONFIG.get(self._state, (MODE_OFF, None))

        if color_name:
            self._set_color(*COLORS[color_name])

        # Error and alarm use flashing (toggle on/off rapidly)
        if self._state in (LedState.ERROR, LedState.ALARM):
            speed = 4.0 if self._state == LedState.ERROR else 6.0
            self._start_flash(COLORS[color_name], speed)
        else:
            self._set_mode(mode)

    # ── I2C Helpers ───────────────────────────────────────────────────

    def _set_mode(self, mode: int):
        if self._bus:
            try:
                self._bus.write_byte_data(I2C_ADDR, REG_LED_MODE, mode)
            except Exception:
                pass

    def _set_color(self, r: int, g: int, b: int):
        if self._bus:
            try:
                self._bus.write_i2c_block_data(I2C_ADDR, REG_LED_ALL, [r, g, b])
            except Exception:
                pass

    def _set_led(self, led_id: int, r: int, g: int, b: int):
        if self._bus:
            try:
                self._bus.write_i2c_block_data(I2C_ADDR, REG_LED_SPECIFIED, [led_id, r, g, b])
            except Exception:
                pass

    # ── Flash Pattern (for error/alarm) ───────────────────────────────

    def _start_flash(self, color: tuple, speed: float):
        self._flash_stop.clear()
        self._flash_thread = threading.Thread(
            target=self._flash_loop, args=(color, speed), daemon=True
        )
        self._flash_thread.start()

    def _stop_flash(self):
        self._flash_stop.set()
        if self._flash_thread:
            self._flash_thread.join(timeout=1)
            self._flash_thread = None

    def _flash_loop(self, color: tuple, speed: float):
        interval = 1.0 / speed
        on = True
        while not self._flash_stop.is_set():
            if on:
                self._set_color(*color)
                self._set_mode(MODE_STATIC)
            else:
                self._set_mode(MODE_OFF)
            on = not on
            self._flash_stop.wait(interval)


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
