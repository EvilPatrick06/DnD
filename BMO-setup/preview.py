"""Preview BMO UI on Windows — mock services, no Pi hardware needed.

Usage:
    cd pi-setup
    pip install flask flask-socketio gevent gevent-websocket
    python preview.py

Then open http://localhost:5000 in your browser.
"""

import datetime
import os
import sys
import threading
import time

# Add bmo/ to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "bmo"))

from flask import Flask, Response, jsonify, render_template, request
from flask_socketio import SocketIO

app = Flask(
    __name__,
    template_folder=os.path.join("bmo", "templates"),
    static_folder=os.path.join("bmo", "static"),
)
app.config["SECRET_KEY"] = "preview"
socketio = SocketIO(app, async_mode="gevent", cors_allowed_origins="*")

# ── Mock Data ────────────────────────────────────────────────────────

MOCK_WEATHER = {
    "temperature": 42,
    "feels_like": 36,
    "humidity": 35,
    "wind_speed": 12,
    "description": "Partly cloudy",
    "icon": "cloudy",
    "weather_code": 2,
    "forecast": [
        {"date": "2026-02-22", "high": 48, "low": 28, "description": "Partly cloudy", "icon": "cloudy"},
        {"date": "2026-02-23", "high": 52, "low": 30, "description": "Clear sky", "icon": "clear"},
        {"date": "2026-02-24", "high": 45, "low": 25, "description": "Slight snow", "icon": "snow"},
    ],
}

MOCK_EVENTS = [
    {
        "id": "1", "summary": "Cybersecurity Lab", "description": "", "location": "PPSC Room 214",
        "start": "Mon Feb 23, 10:00 AM", "end": "Mon Feb 23, 11:30 AM",
        "start_iso": "2026-02-23T10:00:00-07:00", "end_iso": "2026-02-23T11:30:00-07:00", "all_day": False,
    },
    {
        "id": "2", "summary": "FBLA Meeting", "description": "Monthly chapter meeting", "location": "Student Center",
        "start": "Tue Feb 24, 04:00 PM", "end": "Tue Feb 24, 05:00 PM",
        "start_iso": "2026-02-24T16:00:00-07:00", "end_iso": "2026-02-24T17:00:00-07:00", "all_day": False,
    },
    {
        "id": "3", "summary": "D&D Session", "description": "Campaign night", "location": "",
        "start": "Fri Feb 27, 07:00 PM", "end": "Fri Feb 27, 11:00 PM",
        "start_iso": "2026-02-27T19:00:00-07:00", "end_iso": "2026-02-27T23:00:00-07:00", "all_day": False,
    },
]

MOCK_SONG = {
    "videoId": "abc123",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "album": "A Night at the Opera",
    "duration": "5:55",
    "thumbnail": "https://placehold.co/300x300/111827/d97706?text=BMO",
}

MOCK_MUSIC_STATE = {
    "song": None, "is_playing": False, "position": 0, "duration": 0,
    "volume": 50, "output_device": "local", "queue_length": 0,
    "queue_index": -1, "shuffle": False, "repeat": "off",
}

MOCK_SEARCH_RESULTS = [
    {"videoId": "1", "title": "Bohemian Rhapsody", "artist": "Queen", "album": "A Night at the Opera", "duration": "5:55", "thumbnail": "https://placehold.co/80x80/1f2937/f3f4f6?text=Q"},
    {"videoId": "2", "title": "Stairway to Heaven", "artist": "Led Zeppelin", "album": "Led Zeppelin IV", "duration": "8:02", "thumbnail": "https://placehold.co/80x80/1f2937/f3f4f6?text=LZ"},
    {"videoId": "3", "title": "Hotel California", "artist": "Eagles", "album": "Hotel California", "duration": "6:30", "thumbnail": "https://placehold.co/80x80/1f2937/f3f4f6?text=E"},
    {"videoId": "4", "title": "Sweet Child O' Mine", "artist": "Guns N' Roses", "album": "Appetite for Destruction", "duration": "5:56", "thumbnail": "https://placehold.co/80x80/1f2937/f3f4f6?text=GNR"},
    {"videoId": "5", "title": "Lose Yourself", "artist": "Eminem", "album": "8 Mile", "duration": "5:26", "thumbnail": "https://placehold.co/80x80/1f2937/f3f4f6?text=Em"},
]

chat_history = []
timers_list = []
music_state = dict(MOCK_MUSIC_STATE)


# ── Pages ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── Chat ─────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.json or {}
    msg = data.get("message", "")
    replies = {
        "hello": "Hi Gavin! BMO is happy to see you!",
        "hi": "Hello hello! BMO is here!",
        "weather": "It's 42 degrees and partly cloudy in Colorado Springs! Brr, bundle up Gavin!",
        "time": f"It is {datetime.datetime.now().strftime('%I:%M %p')}! Time flies when BMO is having fun!",
    }
    text = replies.get(msg.lower().strip(), f"BMO heard you say: \"{msg}\"! That's interesting! BMO is just a preview right now though.")
    return jsonify({"text": text, "speaker": "gavin", "commands_executed": []})


# ── Music ────────────────────────────────────────────────────────────

@app.route("/api/music/search")
def api_music_search():
    return jsonify(MOCK_SEARCH_RESULTS)


@app.route("/api/music/play", methods=["POST"])
def api_music_play():
    data = request.json or {}
    song = data.get("song", MOCK_SONG)
    music_state["song"] = song
    music_state["is_playing"] = True
    music_state["duration"] = 355
    music_state["position"] = 0
    return jsonify({"ok": True})


@app.route("/api/music/pause", methods=["POST"])
def api_music_pause():
    music_state["is_playing"] = not music_state["is_playing"]
    return jsonify({"ok": True})


@app.route("/api/music/stop", methods=["POST"])
def api_music_stop():
    music_state["song"] = None
    music_state["is_playing"] = False
    return jsonify({"ok": True})


@app.route("/api/music/next", methods=["POST"])
def api_music_next():
    return jsonify({"ok": True})


@app.route("/api/music/previous", methods=["POST"])
def api_music_previous():
    return jsonify({"ok": True})


@app.route("/api/music/seek", methods=["POST"])
def api_music_seek():
    data = request.json or {}
    music_state["position"] = data.get("position", 0)
    return jsonify({"ok": True})


@app.route("/api/music/volume", methods=["POST"])
def api_music_volume():
    return jsonify({"ok": True})


@app.route("/api/music/state")
def api_music_state():
    # Simulate playback progress
    if music_state["is_playing"] and music_state["song"]:
        music_state["position"] = min(music_state["position"] + 2, music_state["duration"])
    return jsonify(music_state)


@app.route("/api/music/devices")
def api_music_devices():
    return jsonify([
        {"name": "local", "label": "Pi Speakers"},
        {"name": "Living Room TV", "label": "Living Room TV"},
        {"name": "Gavin's Nest Mini", "label": "Gavin's Nest Mini"},
    ])


@app.route("/api/music/cast", methods=["POST"])
def api_music_cast():
    data = request.json or {}
    music_state["output_device"] = data.get("device", "local")
    return jsonify({"ok": True})


@app.route("/api/music/shuffle", methods=["POST"])
def api_music_shuffle():
    music_state["shuffle"] = not music_state["shuffle"]
    return jsonify({"shuffle": music_state["shuffle"]})


@app.route("/api/music/repeat", methods=["POST"])
def api_music_repeat():
    cycle = {"off": "all", "all": "one", "one": "off"}
    music_state["repeat"] = cycle.get(music_state["repeat"], "off")
    return jsonify({"repeat": music_state["repeat"]})


# ── Calendar ─────────────────────────────────────────────────────────

@app.route("/api/calendar/events")
def api_calendar_events():
    return jsonify(MOCK_EVENTS)


@app.route("/api/calendar/today")
def api_calendar_today():
    return jsonify(MOCK_EVENTS[:1])


@app.route("/api/calendar/next")
def api_calendar_next():
    return jsonify(MOCK_EVENTS[0])


# ── Camera (mock — placeholder image) ───────────────────────────────

@app.route("/api/camera/stream")
def api_camera_stream():
    # No camera in preview mode — return 404 so the UI shows "Camera offline"
    return "", 404


@app.route("/api/camera/snapshot", methods=["POST"])
def api_camera_snapshot():
    return jsonify({"path": "/mock/snapshot.jpg"})


@app.route("/api/camera/describe", methods=["POST"])
def api_camera_describe():
    return jsonify({"description": "BMO sees a laptop screen with code on it! Very cool, Gavin!"})


@app.route("/api/camera/faces")
def api_camera_faces():
    return jsonify([{"name": "gavin", "location": {"top": 100, "right": 300, "bottom": 300, "left": 100}}])


@app.route("/api/camera/objects")
def api_camera_objects():
    return jsonify([{"class": "laptop", "confidence": 0.95, "bbox": {"x1": 50, "y1": 50, "x2": 400, "y2": 350}}])


@app.route("/api/camera/motion", methods=["POST"])
def api_camera_motion():
    return jsonify({"ok": True})


# ── Timers ───────────────────────────────────────────────────────────

@app.route("/api/timers")
def api_timers():
    # Tick down mock timers
    for t in timers_list:
        if not t.get("paused") and not t.get("fired") and t["remaining"] > 0:
            t["remaining"] = max(0, t["remaining"] - 1)
    return jsonify(timers_list)


@app.route("/api/timers/create", methods=["POST"])
def api_timer_create():
    data = request.json or {}
    timer = {
        "id": str(len(timers_list) + 1),
        "label": data.get("label", "Timer"),
        "duration": data.get("seconds", 300),
        "remaining": data.get("seconds", 300),
        "paused": False, "fired": False, "type": "timer",
    }
    timers_list.append(timer)
    return jsonify(timer)


@app.route("/api/timers/<tid>/cancel", methods=["POST"])
def api_timer_cancel(tid):
    timers_list[:] = [t for t in timers_list if t["id"] != tid]
    return jsonify({"ok": True})


@app.route("/api/timers/<tid>/pause", methods=["POST"])
def api_timer_pause(tid):
    for t in timers_list:
        if t["id"] == tid:
            t["paused"] = not t["paused"]
    return jsonify({"ok": True})


@app.route("/api/alarms/create", methods=["POST"])
def api_alarm_create():
    data = request.json or {}
    h, m = data.get("hour", 7), data.get("minute", 0)
    now = datetime.datetime.now()
    target = now.replace(hour=h, minute=m, second=0)
    if target <= now:
        target += datetime.timedelta(days=1)
    remaining = int((target - now).total_seconds())
    alarm = {
        "id": str(len(timers_list) + 1),
        "label": data.get("label", f"Alarm ({h}:{m:02d})"),
        "target_time": target.strftime("%I:%M %p"),
        "remaining": remaining,
        "fired": False, "snoozed": False, "type": "alarm",
    }
    timers_list.append(alarm)
    return jsonify(alarm)


@app.route("/api/alarms/<aid>/cancel", methods=["POST"])
def api_alarm_cancel(aid):
    timers_list[:] = [t for t in timers_list if t["id"] != aid]
    return jsonify({"ok": True})


@app.route("/api/alarms/<aid>/snooze", methods=["POST"])
def api_alarm_snooze(aid):
    return jsonify({"ok": True})


# ── Weather ──────────────────────────────────────────────────────────

@app.route("/api/weather")
def api_weather():
    return jsonify(MOCK_WEATHER)


# ── Devices ──────────────────────────────────────────────────────────

@app.route("/api/devices")
def api_devices():
    return jsonify([
        {"name": "Living Room TV", "model": "Chromecast", "status": "idle"},
        {"name": "Gavin's Nest Mini", "model": "Google Nest Mini", "status": "idle"},
    ])


# ── WebSocket ────────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    socketio.emit("weather_update", MOCK_WEATHER)
    socketio.emit("music_state", music_state)
    socketio.emit("timers_tick", timers_list)
    socketio.emit("next_event", MOCK_EVENTS[0])


@socketio.on("chat_message")
def on_chat_message(data):
    msg = data.get("message", "")
    text = f"BMO heard you say: \"{msg}\"! BMO is in preview mode right now!"
    socketio.emit("chat_response", {"text": text, "speaker": "gavin", "commands_executed": []})


# ── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print()
    print("  ================================")
    print("  BMO UI Preview")
    print("  Open: http://localhost:5000")
    print("  ================================")
    print()
    print("  Tip: Resize your browser to 800x480")
    print("  to match the Pi touchscreen.")
    print()
    socketio.run(app, host="127.0.0.1", port=5000, debug=False, use_reloader=False)
