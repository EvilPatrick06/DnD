"""BMO OLED Face — Animated pixel-art BMO face with expression state machine.

128x64 pixel display using luma.oled. Renders dynamic expressions reflecting BMO's state.
Triggered by SocketIO events from the Flask app.
"""

import os
import threading
import time
from enum import Enum

try:
    from luma.core.interface.serial import i2c
    from luma.oled.device import ssd1306
    from PIL import Image, ImageDraw, ImageFont
    OLED_AVAILABLE = True
except ImportError:
    OLED_AVAILABLE = False

# Display dimensions
WIDTH = 128
HEIGHT = 64
FPS = 10
FRAME_DELAY = 1.0 / FPS


class Expression(Enum):
    """BMO face expressions."""
    IDLE = "idle"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    HAPPY = "happy"
    ERROR = "error"
    ALERT = "alert"
    COMBAT = "combat"
    SLEEPING = "sleeping"


class OledFace:
    """Animated pixel-art BMO face on 128x64 OLED display.

    State machine for expressions. 10 FPS animation loop.
    Expressions are triggered by SocketIO events or direct API calls.
    """

    def __init__(self, socketio=None):
        self.socketio = socketio
        self._device = None
        self._expression = Expression.IDLE
        self._running = False
        self._render_thread = None
        self._frame_counter = 0
        self._blink_timer = 0
        self._blink_state = False
        self._mouth_state = 0  # 0=closed, 1=half, 2=open
        self._thinking_angle = 0
        self._alert_flash = False

    def start(self):
        """Initialize OLED and start the animation loop."""
        if not OLED_AVAILABLE:
            print("[oled] luma.oled not available — running headless")
            return

        try:
            serial = i2c(port=1, address=0x3C)
            self._device = ssd1306(serial, width=WIDTH, height=HEIGHT)
            self._device.contrast(200)
        except Exception as e:
            print(f"[oled] Failed to init display: {e}")
            return

        self._running = True
        self._render_thread = threading.Thread(target=self._animation_loop, daemon=True)
        self._render_thread.start()
        print("[oled] BMO face started")

    def stop(self):
        """Stop the animation loop and clear display."""
        self._running = False
        if self._device:
            self._device.hide()

    def set_expression(self, expression: str):
        """Change BMO's expression. Accepts Expression enum value strings."""
        try:
            self._expression = Expression(expression)
        except ValueError:
            print(f"[oled] Unknown expression: {expression}")
        self._frame_counter = 0

    @property
    def current_expression(self) -> str:
        return self._expression.value

    # ── Animation Loop ────────────────────────────────────────────────

    def _animation_loop(self):
        """Main render loop at 10 FPS."""
        while self._running:
            start = time.time()

            img = Image.new("1", (WIDTH, HEIGHT), 0)
            draw = ImageDraw.Draw(img)

            self._render_frame(draw)

            if self._device:
                self._device.display(img)

            self._frame_counter += 1
            elapsed = time.time() - start
            sleep_time = max(0, FRAME_DELAY - elapsed)
            time.sleep(sleep_time)

    def _render_frame(self, draw: "ImageDraw.Draw"):
        """Render the current expression frame."""
        expr = self._expression

        if expr == Expression.IDLE:
            self._render_idle(draw)
        elif expr == Expression.LISTENING:
            self._render_listening(draw)
        elif expr == Expression.THINKING:
            self._render_thinking(draw)
        elif expr == Expression.SPEAKING:
            self._render_speaking(draw)
        elif expr == Expression.HAPPY:
            self._render_happy(draw)
        elif expr == Expression.ERROR:
            self._render_error(draw)
        elif expr == Expression.ALERT:
            self._render_alert(draw)
        elif expr == Expression.COMBAT:
            self._render_combat(draw)
        elif expr == Expression.SLEEPING:
            self._render_sleeping(draw)

    # ── Expression Renderers ──────────────────────────────────────────

    def _render_idle(self, draw):
        """Neutral face with slow blink animation."""
        # Blink every ~4 seconds (40 frames at 10 FPS)
        self._blink_timer += 1
        if self._blink_timer >= 40:
            self._blink_state = True
            if self._blink_timer >= 43:  # Blink lasts 3 frames
                self._blink_state = False
                self._blink_timer = 0

        # Face outline
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Eyes
        if self._blink_state:
            # Blink — horizontal lines
            draw.line([35, 25, 50, 25], fill=1, width=2)
            draw.line([78, 25, 93, 25], fill=1, width=2)
        else:
            # Open eyes — oval
            draw.ellipse([35, 18, 50, 32], outline=1, fill=1)
            draw.ellipse([78, 18, 93, 32], outline=1, fill=1)
            # Pupils
            draw.ellipse([40, 22, 45, 28], outline=0, fill=0)
            draw.ellipse([83, 22, 88, 28], outline=0, fill=0)

        # Mouth — small neutral line
        draw.line([52, 44, 76, 44], fill=1, width=1)

    def _render_listening(self, draw):
        """Wide eyes with ear/mic indicators."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Wide open eyes
        draw.ellipse([32, 14, 52, 34], outline=1, fill=1)
        draw.ellipse([76, 14, 96, 34], outline=1, fill=1)
        # Large pupils
        draw.ellipse([38, 20, 46, 28], outline=0, fill=0)
        draw.ellipse([82, 20, 90, 28], outline=0, fill=0)

        # Small 'o' mouth (attentive)
        draw.ellipse([58, 40, 70, 50], outline=1, fill=0)

        # Mic indicator — small radiating arcs on the sides
        phase = self._frame_counter % 10
        if phase < 5:
            draw.arc([2, 20, 12, 44], start=270, end=90, fill=1)
            draw.arc([116, 20, 126, 44], start=90, end=270, fill=1)

    def _render_thinking(self, draw):
        """Rotating dots loading animation."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Squinting eyes (thinking)
        draw.line([35, 23, 50, 23], fill=1, width=2)
        draw.line([78, 23, 93, 23], fill=1, width=2)
        # Small eyebrow lines
        draw.line([35, 18, 50, 18], fill=1, width=1)
        draw.line([78, 18, 93, 18], fill=1, width=1)

        # Rotating dots
        import math
        cx, cy = 64, 46
        radius = 8
        num_dots = 3
        self._thinking_angle += 0.3
        for i in range(num_dots):
            angle = self._thinking_angle + (i * 2 * math.pi / num_dots)
            x = int(cx + radius * math.cos(angle))
            y = int(cy + radius * math.sin(angle))
            size = 3 if i == 0 else 2
            draw.ellipse([x - size, y - size, x + size, y + size], fill=1)

    def _render_speaking(self, draw):
        """Mouth animation synced to speaking state."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Normal eyes
        draw.ellipse([35, 18, 50, 32], outline=1, fill=1)
        draw.ellipse([78, 18, 93, 32], outline=1, fill=1)
        draw.ellipse([40, 22, 45, 28], outline=0, fill=0)
        draw.ellipse([83, 22, 88, 28], outline=0, fill=0)

        # Animated mouth — cycles through shapes
        self._mouth_state = (self._frame_counter // 2) % 4
        if self._mouth_state == 0:
            draw.line([52, 44, 76, 44], fill=1, width=1)  # Closed
        elif self._mouth_state == 1:
            draw.ellipse([54, 40, 74, 48], outline=1, fill=0)  # Small open
        elif self._mouth_state == 2:
            draw.ellipse([50, 38, 78, 52], outline=1, fill=0)  # Wide open
        elif self._mouth_state == 3:
            draw.ellipse([54, 40, 74, 48], outline=1, fill=0)  # Small open

    def _render_happy(self, draw):
        """Smile with squinted eyes."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Squinted happy eyes (upward arcs)
        draw.arc([32, 16, 53, 36], start=200, end=340, fill=1, width=2)
        draw.arc([75, 16, 96, 36], start=200, end=340, fill=1, width=2)

        # Big smile
        draw.arc([40, 32, 88, 56], start=0, end=180, fill=1, width=2)

    def _render_error(self, draw):
        """X eyes with frown."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # X eyes
        draw.line([35, 18, 50, 32], fill=1, width=2)
        draw.line([50, 18, 35, 32], fill=1, width=2)
        draw.line([78, 18, 93, 32], fill=1, width=2)
        draw.line([93, 18, 78, 32], fill=1, width=2)

        # Frown
        draw.arc([40, 42, 88, 58], start=180, end=360, fill=1, width=2)

    def _render_alert(self, draw):
        """Exclamation mark with flashing border."""
        self._alert_flash = not self._alert_flash

        if self._alert_flash:
            draw.rectangle([8, 2, 120, 62], outline=1)
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Alert eyes (wide, worried)
        draw.ellipse([32, 14, 52, 34], outline=1, fill=1)
        draw.ellipse([76, 14, 96, 34], outline=1, fill=1)
        draw.ellipse([38, 18, 46, 30], outline=0, fill=0)
        draw.ellipse([82, 18, 90, 30], outline=0, fill=0)

        # Exclamation mark below eyes
        draw.rectangle([62, 38, 66, 50], fill=1)
        draw.rectangle([62, 53, 66, 57], fill=1)

    def _render_combat(self, draw):
        """Sword icon + determined face."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Determined eyes (angled)
        draw.line([35, 20, 50, 24], fill=1, width=2)
        draw.line([78, 24, 93, 20], fill=1, width=2)
        draw.ellipse([38, 24, 48, 32], outline=1, fill=1)
        draw.ellipse([80, 24, 90, 32], outline=1, fill=1)

        # Determined mouth
        draw.line([50, 46, 78, 46], fill=1, width=2)

        # Small sword icon in corner
        draw.line([108, 8, 114, 8], fill=1, width=1)  # crossguard
        draw.line([111, 4, 111, 14], fill=1, width=1)  # blade
        draw.line([111, 14, 111, 18], fill=1, width=2)  # hilt

    def _render_sleeping(self, draw):
        """Closed eyes with Zzz animation."""
        draw.rounded_rectangle([10, 4, 118, 60], radius=8, outline=1)

        # Closed eyes (horizontal lines, low)
        draw.line([35, 28, 50, 28], fill=1, width=2)
        draw.line([78, 28, 93, 28], fill=1, width=2)

        # Slight smile
        draw.arc([48, 38, 80, 52], start=0, end=180, fill=1, width=1)

        # Animated Zzz
        phase = (self._frame_counter // 8) % 3
        base_x, base_y = 96, 8
        for i in range(phase + 1):
            x = base_x + i * 6
            y = base_y - i * 6
            size = 4 + i
            # Draw a small Z
            draw.line([x, y, x + size, y], fill=1)
            draw.line([x + size, y, x, y + size], fill=1)
            draw.line([x, y + size, x + size, y + size], fill=1)
