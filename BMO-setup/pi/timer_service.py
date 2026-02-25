"""BMO Timer & Alarm Service — Countdown timers and scheduled alarms."""

import datetime
import threading
import time
import uuid


class Timer:
    """A countdown timer."""

    def __init__(self, duration_sec: int, label: str = ""):
        self.id = str(uuid.uuid4())[:8]
        self.label = label or f"Timer ({duration_sec}s)"
        self.duration = duration_sec
        self.remaining = duration_sec
        self.started_at = time.time()
        self.paused = False
        self.fired = False

    def tick(self) -> bool:
        """Update remaining time. Returns True if timer just fired."""
        if self.paused or self.fired:
            return False
        elapsed = time.time() - self.started_at
        self.remaining = max(0, self.duration - int(elapsed))
        if self.remaining == 0 and not self.fired:
            self.fired = True
            return True
        return False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "duration": self.duration,
            "remaining": self.remaining,
            "paused": self.paused,
            "fired": self.fired,
            "type": "timer",
        }


class Alarm:
    """A scheduled alarm."""

    def __init__(self, target_time: datetime.datetime, label: str = ""):
        self.id = str(uuid.uuid4())[:8]
        self.label = label or f"Alarm ({target_time.strftime('%I:%M %p')})"
        self.target_time = target_time
        self.fired = False
        self.snoozed = False

    def check(self) -> bool:
        """Check if the alarm should fire now. Returns True if it just triggered."""
        if self.fired:
            return False
        now = datetime.datetime.now()
        if now >= self.target_time:
            self.fired = True
            return True
        return False

    def snooze(self, minutes: int = 5):
        """Snooze the alarm for N minutes."""
        self.target_time = datetime.datetime.now() + datetime.timedelta(minutes=minutes)
        self.fired = False
        self.snoozed = True

    @property
    def remaining(self) -> int:
        """Seconds until alarm fires."""
        delta = (self.target_time - datetime.datetime.now()).total_seconds()
        return max(0, int(delta))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "target_time": self.target_time.strftime("%I:%M %p"),
            "remaining": self.remaining,
            "fired": self.fired,
            "snoozed": self.snoozed,
            "type": "alarm",
        }


class TimerService:
    """Manages timers and alarms with background tick loop."""

    def __init__(self, voice_pipeline=None, socketio=None):
        self.voice = voice_pipeline
        self.socketio = socketio
        self._timers: dict[str, Timer] = {}
        self._alarms: dict[str, Alarm] = {}
        self._running = False
        self._tick_thread = None

    # ── Timer Operations ─────────────────────────────────────────────

    def create_timer(self, duration_sec: int, label: str = "") -> dict:
        """Create a new countdown timer."""
        timer = Timer(duration_sec, label)
        self._timers[timer.id] = timer
        self._ensure_running()
        self._emit("timer_created", timer.to_dict())
        return timer.to_dict()

    def cancel_timer(self, timer_id: str) -> bool:
        """Cancel and remove a timer."""
        if timer_id in self._timers:
            del self._timers[timer_id]
            self._emit("timer_cancelled", {"id": timer_id})
            return True
        return False

    def pause_timer(self, timer_id: str) -> bool:
        """Pause a timer."""
        timer = self._timers.get(timer_id)
        if timer:
            timer.paused = not timer.paused
            if not timer.paused:
                # Adjust started_at so remaining time is preserved
                timer.started_at = time.time() - (timer.duration - timer.remaining)
            return True
        return False

    # ── Alarm Operations ─────────────────────────────────────────────

    def create_alarm(self, hour: int, minute: int, label: str = "") -> dict:
        """Create a new alarm at a specific time today (or tomorrow if time has passed)."""
        now = datetime.datetime.now()
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now:
            target += datetime.timedelta(days=1)

        alarm = Alarm(target, label)
        self._alarms[alarm.id] = alarm
        self._ensure_running()
        self._emit("alarm_created", alarm.to_dict())
        return alarm.to_dict()

    def cancel_alarm(self, alarm_id: str) -> bool:
        """Cancel and remove an alarm."""
        if alarm_id in self._alarms:
            del self._alarms[alarm_id]
            self._emit("alarm_cancelled", {"id": alarm_id})
            return True
        return False

    def snooze_alarm(self, alarm_id: str, minutes: int = 5) -> bool:
        """Snooze a fired alarm."""
        alarm = self._alarms.get(alarm_id)
        if alarm and alarm.fired:
            alarm.snooze(minutes)
            self._emit("alarm_snoozed", alarm.to_dict())
            return True
        return False

    # ── List All ─────────────────────────────────────────────────────

    def get_all(self) -> list[dict]:
        """Get all active timers and alarms."""
        items = []
        items.extend(t.to_dict() for t in self._timers.values() if not t.fired)
        items.extend(a.to_dict() for a in self._alarms.values() if not a.fired)
        return items

    # ── Background Tick Loop ─────────────────────────────────────────

    def _ensure_running(self):
        if self._running:
            return
        self._running = True
        self._tick_thread = threading.Thread(target=self._tick_loop, daemon=True)
        self._tick_thread.start()

    def _tick_loop(self):
        while self._running:
            # Tick timers
            for timer in list(self._timers.values()):
                if timer.tick():
                    self._on_timer_fired(timer)

            # Check alarms
            for alarm in list(self._alarms.values()):
                if alarm.check():
                    self._on_alarm_fired(alarm)

            # Broadcast state updates every second
            self._emit("timers_tick", self.get_all())

            time.sleep(1)

    def _on_timer_fired(self, timer: Timer):
        """Called when a timer reaches zero."""
        msg = f"Beep boop! {timer.label} is done!"
        print(f"[timer] FIRED: {timer.label}")
        self._emit("timer_fired", {"id": timer.id, "label": timer.label, "message": msg})

        # Speak the alert
        if self.voice:
            self.voice.speak(msg)

        # Clean up after a short delay
        threading.Timer(5.0, lambda: self._timers.pop(timer.id, None)).start()

    def _on_alarm_fired(self, alarm: Alarm):
        """Called when an alarm triggers."""
        msg = f"Wake up wake up! {alarm.label}!"
        print(f"[alarm] FIRED: {alarm.label}")
        self._emit("alarm_fired", {"id": alarm.id, "label": alarm.label, "message": msg})

        if self.voice:
            self.voice.speak(msg)

    def stop(self):
        self._running = False

    def _emit(self, event: str, data):
        if self.socketio:
            self.socketio.emit(event, data)
