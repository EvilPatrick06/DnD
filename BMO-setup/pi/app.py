"""BMO — AI Voice + Vision Assistant for Raspberry Pi 5.

Main Flask application with WebSocket support. Serves the touchscreen UI
and provides API endpoints for all services.

Usage:
    source ~/bmo/venv/bin/activate
    python app.py
"""

import asyncio
import json
import os
import secrets
import threading
import time

from flask import Flask, Response, jsonify, render_template, request
from flask_socketio import SocketIO

# ── App Setup ────────────────────────────────────────────────────────

app = Flask(__name__, template_folder="templates", static_folder="static")


def _get_secret_key() -> str:
    """Return a stable SECRET_KEY: env var > persisted file > generate + persist."""
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    key_path = os.path.join(os.path.expanduser("~"), ".bmo_secret_key")
    try:
        with open(key_path, "r") as f:
            key = f.read().strip()
        if key:
            return key
    except FileNotFoundError:
        pass
    key = secrets.token_hex(32)
    with open(key_path, "w") as f:
        f.write(key)
    os.chmod(key_path, 0o600)
    return key


app.config["SECRET_KEY"] = _get_secret_key()
socketio = SocketIO(app, async_mode="gevent", cors_allowed_origins="*")

# ── Services (lazy-initialized) ─────────────────────────────────────

voice = None
camera = None
calendar = None
music = None
smart_home = None
weather = None
timers = None
agent = None


def init_services():
    """Initialize all services. Called once on startup.
    Gracefully skips hardware-dependent services when running on non-Pi platforms.
    """
    global voice, camera, calendar, music, smart_home, weather, timers, agent

    from agent import BmoAgent

    print("[bmo] Initializing services...")

    service_map = {}

    # Voice pipeline (requires pyaudio/mic hardware)
    try:
        from voice_pipeline import VoicePipeline
        voice = VoicePipeline(socketio=socketio)
        service_map["voice"] = voice
        print("[bmo]   Voice pipeline: OK")
    except Exception as e:
        print(f"[bmo]   Voice pipeline: SKIPPED ({e})")

    # Camera (requires picamera2)
    try:
        from camera_service import CameraService
        camera = CameraService(socketio=socketio)
        service_map["camera"] = camera
        print("[bmo]   Camera: OK")
    except Exception as e:
        print(f"[bmo]   Camera: SKIPPED ({e})")

    # Smart home / Chromecast
    try:
        from smart_home import SmartHomeService
        smart_home = SmartHomeService(socketio=socketio)
        service_map["smart_home"] = smart_home
        print("[bmo]   Smart home: OK")
    except Exception as e:
        print(f"[bmo]   Smart home: SKIPPED ({e})")

    # Calendar (Google API)
    try:
        from calendar_service import CalendarService
        calendar = CalendarService(socketio=socketio)
        service_map["calendar"] = calendar
        print("[bmo]   Calendar: OK")
    except Exception as e:
        print(f"[bmo]   Calendar: SKIPPED ({e})")

    # Weather
    try:
        from weather_service import WeatherService
        weather = WeatherService(socketio=socketio)
        service_map["weather"] = weather
        print("[bmo]   Weather: OK")
    except Exception as e:
        print(f"[bmo]   Weather: SKIPPED ({e})")

    # Music (requires ytmusicapi/vlc)
    try:
        from music_service import MusicService
        music = MusicService(smart_home=smart_home, socketio=socketio)
        service_map["music"] = music
        print("[bmo]   Music: OK")
    except Exception as e:
        print(f"[bmo]   Music: SKIPPED ({e})")

    # Timers
    try:
        from timer_service import TimerService
        timers = TimerService(voice_pipeline=voice, socketio=socketio)
        service_map["timers"] = timers
        print("[bmo]   Timers: OK")
    except Exception as e:
        print(f"[bmo]   Timers: SKIPPED ({e})")

    # Agent (core — always required)
    agent = BmoAgent(services=service_map, socketio=socketio)

    # Start background services that loaded successfully
    if smart_home:
        smart_home.start_discovery()
    if calendar:
        calendar.start_polling()
    if weather:
        weather.start_polling()
    if voice:
        voice.start_listening()

    # Load notes from disk
    _load_notes()

    # Restore chat history into agent memory
    _restore_agent_history()

    # Try to connect to TV
    init_tv_remote()

    print("[bmo] All services initialized!")


# ── Pages ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── Chat API ─────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.json or {}
    message = data.get("message", "")
    speaker = data.get("speaker", "unknown")

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # Save user message immediately
    _save_chat_message({"role": "user", "text": message, "speaker": speaker, "ts": time.time()})

    result = agent.chat(message, speaker=speaker)

    # Save assistant response immediately
    _save_chat_message({"role": "assistant", "text": result["text"], "ts": time.time()})

    # Speak the response (in background so API returns immediately)
    if voice:
        threading.Thread(target=voice.speak, args=(result["text"],), daemon=True).start()

    return jsonify(result)


@app.route("/api/dnd/load", methods=["POST"])
def api_dnd_load():
    """Manually load DnD context with character files and map selection."""
    data = request.json or {}
    char_paths = data.get("characters", [])
    maps_dir = data.get("maps_dir", "")
    chosen_map = data.get("map", None)

    if not char_paths:
        return jsonify({"error": "No character file paths provided"}), 400

    selected_map = agent.load_dnd_context(char_paths, maps_dir, chosen_map)
    return jsonify({"ok": True, "map": selected_map})


@app.route("/api/dnd/sessions")
def api_dnd_sessions():
    """List all saved DnD session log files."""
    if not os.path.isdir(DND_LOG_DIR):
        return jsonify([])
    sessions = []
    for fname in sorted(os.listdir(DND_LOG_DIR), reverse=True):
        if fname.startswith("session_") and fname.endswith(".json"):
            date = fname.replace("session_", "").replace(".json", "")
            fpath = os.path.join(DND_LOG_DIR, fname)
            try:
                with open(fpath, encoding="utf-8") as f:
                    messages = json.load(f)
                # Get first assistant message as preview
                preview = ""
                for m in messages:
                    if m.get("role") == "assistant":
                        preview = m.get("text", "")[:100]
                        break
                sessions.append({"date": date, "messages": len(messages), "preview": preview})
            except Exception:
                sessions.append({"date": date, "messages": 0, "preview": ""})
    return jsonify(sessions)


@app.route("/api/dnd/sessions/<date>")
def api_dnd_session_get(date):
    """Get a specific DnD session log by date."""
    fpath = os.path.join(DND_LOG_DIR, f"session_{date}.json")
    if not os.path.exists(fpath):
        return jsonify({"error": f"No session found for {date}"}), 404
    try:
        with open(fpath, encoding="utf-8") as f:
            messages = json.load(f)
        return jsonify(messages)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dnd/sessions/<date>/restore", methods=["POST"])
def api_dnd_session_restore(date):
    """Restore a DnD session into the agent's conversation history."""
    fpath = os.path.join(DND_LOG_DIR, f"session_{date}.json")
    if not os.path.exists(fpath):
        return jsonify({"error": f"No session found for {date}"}), 404
    try:
        with open(fpath, encoding="utf-8") as f:
            messages = json.load(f)
        # Clear current history and reload
        agent.conversation_history.clear()
        for msg in messages:
            role = msg.get("role", "user")
            text = msg.get("text", "")
            agent.conversation_history.append({"role": role, "content": text})
        # Re-detect DnD context
        for msg in messages:
            if msg.get("role") == "user" and agent._is_dnd_request(msg.get("text", "")):
                agent._auto_load_dnd(msg["text"])
                break
        # Generate a narrative recap
        recap = ""
        try:
            recap = agent.generate_session_recap(messages)
        except Exception as e:
            print(f"[chat] Recap generation failed: {e}")
        return jsonify({"ok": True, "messages_restored": len(messages), "recap": recap})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dnd/gamestate")
def api_dnd_gamestate():
    """Return the current D&D game state (HP, spell slots, conditions, etc.)."""
    if agent:
        return jsonify(agent.get_gamestate())
    return jsonify({"date": None, "characters": {}})


@app.route("/api/dnd/players")
def api_dnd_players():
    """Return player character names from the active DnD context."""
    if agent:
        return jsonify({"players": agent.get_player_names()})
    return jsonify({"players": []})


# ── Agent System API ─────────────────────────────────────────────────

@app.route("/api/agents")
def api_agents():
    """List all registered agents."""
    if agent and agent.orchestrator:
        agents_list = []
        for name, a in agent.orchestrator.agents.items():
            agents_list.append({
                "name": a.config.name,
                "display_name": a.config.display_name,
                "temperature": a.config.temperature,
                "can_nest": a.config.can_nest,
                "tools": a.config.tools,
            })
        return jsonify({"agents": agents_list, "mode": agent.orchestrator.mode.value})
    return jsonify({"agents": [], "mode": "normal"})


@app.route("/api/scratchpad")
def api_scratchpad():
    """Read the shared scratchpad."""
    if agent and agent.orchestrator:
        return jsonify(agent.orchestrator.scratchpad.to_dict())
    return jsonify({})


@app.route("/api/scratchpad", methods=["POST"])
def api_scratchpad_write():
    """Write to the shared scratchpad."""
    data = request.json or {}
    section = data.get("section", "Notes")
    content = data.get("content", "")
    append = data.get("append", False)
    if agent and agent.orchestrator:
        agent.orchestrator.scratchpad.write(section, content, append)
        return jsonify({"success": True})
    return jsonify({"error": "Agent not initialized"}), 500


@app.route("/api/scratchpad", methods=["DELETE"])
def api_scratchpad_clear():
    """Clear scratchpad section(s)."""
    data = request.json or {}
    section = data.get("section")
    if agent and agent.orchestrator:
        agent.orchestrator.scratchpad.clear(section)
        return jsonify({"success": True})
    return jsonify({"error": "Agent not initialized"}), 500


@app.route("/api/init", methods=["POST"])
def api_init():
    """Create a BMO.md file in the specified directory (/init slash command)."""
    data = request.json or {}
    directory = data.get("directory", ".")
    try:
        from agents.project_context import create_bmo_md
        import os
        # Resolve relative paths
        if not os.path.isabs(directory):
            directory = os.path.abspath(directory)
        path = create_bmo_md(directory)
        return jsonify({"success": True, "path": path})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── Music API ────────────────────────────────────────────────────────

@app.route("/api/music/search")
def api_music_search():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "No query"}), 400
    results = music.search(query)
    return jsonify(results)


@app.route("/api/music/play", methods=["POST"])
def api_music_play():
    data = request.json or {}
    song = data.get("song")
    if song:
        music.play(song)
    else:
        music.play()  # Resume
    return jsonify({"ok": True})


@app.route("/api/music/play-queue", methods=["POST"])
def api_music_play_queue():
    data = request.json or {}
    songs = data.get("songs", [])
    music.play_queue(songs)
    return jsonify({"ok": True})


@app.route("/api/music/pause", methods=["POST"])
def api_music_pause():
    music.pause()
    return jsonify({"ok": True})


@app.route("/api/music/stop", methods=["POST"])
def api_music_stop():
    music.stop()
    return jsonify({"ok": True})


@app.route("/api/music/next", methods=["POST"])
def api_music_next():
    music.next_track()
    return jsonify({"ok": True})


@app.route("/api/music/previous", methods=["POST"])
def api_music_previous():
    music.previous_track()
    return jsonify({"ok": True})


@app.route("/api/music/seek", methods=["POST"])
def api_music_seek():
    data = request.json or {}
    music.seek(data.get("position", 0))
    return jsonify({"ok": True})


@app.route("/api/music/volume", methods=["POST"])
def api_music_volume():
    data = request.json or {}
    music.set_volume(data.get("level", 50))
    return jsonify({"ok": True})


@app.route("/api/music/state")
def api_music_state():
    return jsonify(music.get_state())


@app.route("/api/music/devices")
def api_music_devices():
    return jsonify(music.get_devices())


@app.route("/api/music/cast", methods=["POST"])
def api_music_cast():
    data = request.json or {}
    music.set_output_device(data.get("device", "pi"))
    return jsonify({"ok": True})


@app.route("/api/music/stream-url")
def api_music_stream_url():
    """Return the current audio stream URL for laptop web UI playback."""
    url = music.get_laptop_stream_url()
    if url:
        return jsonify({"url": url})
    return jsonify({"url": None})


@app.route("/api/music/shuffle", methods=["POST"])
def api_music_shuffle():
    music.shuffle = not music.shuffle
    return jsonify({"shuffle": music.shuffle})


@app.route("/api/music/repeat", methods=["POST"])
def api_music_repeat():
    cycle = {"off": "all", "all": "one", "one": "off"}
    music.repeat = cycle.get(music.repeat, "off")
    return jsonify({"repeat": music.repeat})


@app.route("/api/music/queue/add", methods=["POST"])
def api_music_queue_add():
    data = request.json or {}
    song = data.get("song")
    if not song:
        return jsonify({"error": "No song provided"}), 400
    music.add_to_queue(song)
    return jsonify({"ok": True, "queue_length": len(music.queue)})


@app.route("/api/music/queue/remove", methods=["POST"])
def api_music_queue_remove():
    data = request.json or {}
    index = data.get("index")
    if index is None:
        return jsonify({"error": "No index provided"}), 400
    if not music.remove_from_queue(index):
        return jsonify({"error": "Cannot remove that item"}), 400
    return jsonify({"ok": True, "queue_length": len(music.queue)})


@app.route("/api/music/queue")
def api_music_queue():
    return jsonify(music.get_queue())


@app.route("/api/music/album/<browse_id>")
def api_music_album(browse_id):
    try:
        return jsonify(music.get_album(browse_id))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/music/playlist/<browse_id>")
def api_music_playlist(browse_id):
    try:
        return jsonify(music.get_playlist(browse_id))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/music/search/playlists")
def api_music_search_playlists():
    query = request.args.get("q", "")
    if not query:
        return jsonify([])
    try:
        return jsonify(music.search_playlists(query))
    except Exception as e:
        print(f"[music] Playlist search error: {e}")
        return jsonify([])


@app.route("/api/music/history")
def api_music_history():
    return jsonify(music.get_history())


@app.route("/api/music/most-played")
def api_music_most_played():
    return jsonify(music.get_most_played())


@app.route("/api/music/lyrics/<video_id>")
def api_music_lyrics(video_id):
    try:
        return jsonify(music.get_lyrics(video_id))
    except Exception as e:
        return jsonify({"lyrics": None, "error": str(e)})


# ── Calendar API ─────────────────────────────────────────────────────

@app.route("/api/calendar/events")
def api_calendar_events():
    days = int(request.args.get("days", 7))
    events = calendar.get_upcoming_events(days_ahead=days)
    return jsonify(events)


@app.route("/api/calendar/today")
def api_calendar_today():
    return jsonify(calendar.get_today_events())


@app.route("/api/calendar/next")
def api_calendar_next():
    event = calendar.get_next_event()
    return jsonify(event or {})


@app.route("/api/calendar/create", methods=["POST"])
def api_calendar_create():
    data = request.json or {}
    import datetime
    start = datetime.datetime.fromisoformat(data["start"])
    end = datetime.datetime.fromisoformat(data["end"])
    event = calendar.create_event(
        summary=data.get("summary", ""),
        start_dt=start,
        end_dt=end,
        description=data.get("description", ""),
        location=data.get("location", ""),
    )
    return jsonify(event)


@app.route("/api/calendar/update/<event_id>", methods=["PUT"])
def api_calendar_update(event_id):
    data = request.json or {}
    import datetime as _dt
    kwargs = {}
    if "summary" in data:
        kwargs["summary"] = data["summary"]
    if "description" in data:
        kwargs["description"] = data["description"]
    if "location" in data:
        kwargs["location"] = data["location"]
    if "start" in data:
        kwargs["start"] = _dt.datetime.fromisoformat(data["start"])
    if "end" in data:
        kwargs["end"] = _dt.datetime.fromisoformat(data["end"])
    updated = calendar.update_event(event_id, **kwargs)
    return jsonify(updated)


@app.route("/api/calendar/delete/<event_id>", methods=["DELETE"])
def api_calendar_delete(event_id):
    calendar.delete_event(event_id)
    return jsonify({"ok": True})


# ── Camera API ───────────────────────────────────────────────────────

@app.route("/api/camera/stream")
def api_camera_stream():
    return Response(
        camera.generate_mjpeg(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/api/camera/snapshot", methods=["POST"])
def api_camera_snapshot():
    path = camera.take_snapshot()
    return jsonify({"path": path})


@app.route("/api/camera/describe", methods=["POST"])
def api_camera_describe():
    data = request.json or {}
    prompt = data.get("prompt", "What do you see?")
    description = camera.describe_scene(prompt)
    return jsonify({"description": description})


@app.route("/api/camera/faces")
def api_camera_faces():
    faces = camera.identify_faces()
    return jsonify(faces)


@app.route("/api/camera/objects")
def api_camera_objects():
    objects = camera.detect_objects()
    return jsonify(objects)


@app.route("/api/camera/ocr", methods=["POST"])
def api_camera_ocr():
    text = camera.read_text()
    return jsonify({"text": text})


@app.route("/api/camera/motion", methods=["POST"])
def api_camera_motion():
    data = request.json or {}
    if data.get("enabled", True):
        camera.start_motion_detection()
    else:
        camera.stop_motion_detection()
    return jsonify({"ok": True})


# ── Timer API ────────────────────────────────────────────────────────

@app.route("/api/timers")
def api_timers():
    return jsonify(timers.get_all())


@app.route("/api/timers/create", methods=["POST"])
def api_timer_create():
    data = request.json or {}
    timer = timers.create_timer(data.get("seconds", 300), data.get("label", ""))
    return jsonify(timer)


@app.route("/api/timers/<timer_id>/cancel", methods=["POST"])
def api_timer_cancel(timer_id):
    timers.cancel_timer(timer_id)
    return jsonify({"ok": True})


@app.route("/api/timers/<timer_id>/pause", methods=["POST"])
def api_timer_pause(timer_id):
    timers.pause_timer(timer_id)
    return jsonify({"ok": True})


@app.route("/api/alarms/create", methods=["POST"])
def api_alarm_create():
    data = request.json or {}
    alarm = timers.create_alarm(data.get("hour", 7), data.get("minute", 0), data.get("label", ""))
    return jsonify(alarm)


@app.route("/api/alarms/<alarm_id>/cancel", methods=["POST"])
def api_alarm_cancel(alarm_id):
    timers.cancel_alarm(alarm_id)
    return jsonify({"ok": True})


@app.route("/api/alarms/<alarm_id>/snooze", methods=["POST"])
def api_alarm_snooze(alarm_id):
    data = request.json or {}
    timers.snooze_alarm(alarm_id, data.get("minutes", 5))
    return jsonify({"ok": True})


# ── Weather API ──────────────────────────────────────────────────────

@app.route("/api/weather")
def api_weather():
    return jsonify(weather.get_current())


# ── Smart Home API ───────────────────────────────────────────────────

@app.route("/api/devices")
def api_devices():
    return jsonify(smart_home.get_devices())


@app.route("/api/devices/<device_name>/status")
def api_device_status(device_name):
    return jsonify(smart_home.get_status(device_name))


@app.route("/api/devices/<device_name>/volume", methods=["POST"])
def api_device_volume(device_name):
    data = request.json or {}
    smart_home.set_volume(device_name, data.get("level", 0.5))
    return jsonify({"ok": True})


# ── Chat Persistence ─────────────────────────────────────────────────

# Recent chat buffer — kept in memory, served to frontend on refresh
RECENT_CHAT_FILE = os.path.expanduser("~/bmo/data/recent_chat.json")
_MAX_RECENT = 200  # Rolling buffer of recent messages

# DnD session log — permanently saved to its own file
DND_LOG_DIR = os.path.expanduser("~/bmo/data/dnd_sessions")


def _load_recent_chat() -> list[dict]:
    """Load the recent chat buffer from disk."""
    try:
        if os.path.exists(RECENT_CHAT_FILE):
            with open(RECENT_CHAT_FILE, encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[chat] Failed to load recent chat: {e}")
    return []


def _save_recent_message(msg: dict):
    """Append a message to the recent chat buffer (rolling, all chats)."""
    messages = _load_recent_chat()
    messages.append(msg)
    if len(messages) > _MAX_RECENT:
        messages = messages[-_MAX_RECENT:]
    os.makedirs(os.path.dirname(RECENT_CHAT_FILE), exist_ok=True)
    with open(RECENT_CHAT_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False)


def _save_dnd_message(msg: dict):
    """Append a message to the permanent DnD session log."""
    os.makedirs(DND_LOG_DIR, exist_ok=True)
    # One file per day so sessions are easy to find
    date_str = time.strftime("%Y-%m-%d")
    log_file = os.path.join(DND_LOG_DIR, f"session_{date_str}.json")
    messages = []
    try:
        if os.path.exists(log_file):
            with open(log_file, encoding="utf-8") as f:
                messages = json.load(f)
    except Exception:
        messages = []
    messages.append(msg)
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False)


def _save_chat_message(msg: dict):
    """Save a chat message — always to recent buffer, also to DnD log if in DM mode."""
    _save_recent_message(msg)
    if agent and agent._dnd_context:
        _save_dnd_message(msg)


def _restore_agent_history():
    """On startup, restore the agent's conversation history from the recent chat buffer."""
    messages = _load_recent_chat()
    if not messages or not agent:
        return
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("text", "")
        if role == "user":
            agent.conversation_history.append({"role": "user", "content": text})
        elif role == "assistant":
            agent.conversation_history.append({"role": "assistant", "content": text})
    # Re-detect DnD context if it was active
    for msg in messages:
        if msg.get("role") == "user" and agent._is_dnd_request(msg.get("text", "")):
            agent._auto_load_dnd(msg["text"])
            break
    print(f"[chat] Restored {len(messages)} messages into agent history")


@app.route("/api/chat/history")
def api_chat_history():
    """Return recent chat messages for the frontend to restore on refresh."""
    messages = _load_recent_chat()
    return jsonify(messages)


@app.route("/api/chat/clear", methods=["POST"])
def api_chat_clear():
    """Clear chat. If a DnD session is active, save it to the permanent log first."""
    dnd_was_active = agent and agent._dnd_context is not None

    # If DnD session was active, save the full conversation to the session log
    if dnd_was_active:
        try:
            recent = _load_recent_chat()
            if recent:
                # Write the full session as one batch (avoids duplicates from per-message saves)
                os.makedirs(DND_LOG_DIR, exist_ok=True)
                date_str = time.strftime("%Y-%m-%d")
                log_file = os.path.join(DND_LOG_DIR, f"session_{date_str}.json")
                # Merge with any existing messages for today
                existing = []
                try:
                    if os.path.exists(log_file):
                        with open(log_file, encoding="utf-8") as f:
                            existing = json.load(f)
                except Exception:
                    pass
                # Deduplicate by timestamp
                existing_ts = {m.get("ts") for m in existing if m.get("ts")}
                new_msgs = [m for m in recent if m.get("ts") not in existing_ts]
                combined = existing + new_msgs
                with open(log_file, "w", encoding="utf-8") as f:
                    json.dump(combined, f, ensure_ascii=False)
                print(f"[chat] Saved {len(new_msgs)} new messages to DnD session log")
        except Exception as e:
            print(f"[chat] Failed to save DnD session on clear: {e}")

    # Clear the recent chat buffer
    try:
        if os.path.exists(RECENT_CHAT_FILE):
            os.remove(RECENT_CHAT_FILE)
    except Exception:
        pass

    # Save game state alongside session log if DnD was active
    if dnd_was_active and agent and agent._gamestate:
        try:
            date_str = time.strftime("%Y-%m-%d")
            gs_file = os.path.join(DND_LOG_DIR, f"gamestate_{date_str}.json")
            os.makedirs(DND_LOG_DIR, exist_ok=True)
            with open(gs_file, "w", encoding="utf-8") as f:
                json.dump(agent._gamestate, f, ensure_ascii=False, indent=2)
            print(f"[chat] Saved game state to {gs_file}")
        except Exception as e:
            print(f"[chat] Failed to save game state on clear: {e}")

    # Reset agent state
    if agent:
        agent.conversation_history.clear()
        agent._dnd_context = None
        agent._dnd_pending = None
        agent._gamestate = None

    return jsonify({"ok": True, "dnd_saved": dnd_was_active})


# ── Notes API ────────────────────────────────────────────────────────

NOTES_FILE = os.path.expanduser("~/bmo/data/notes.json")
_notes_list: list[dict] = []


def _load_notes():
    global _notes_list
    try:
        if os.path.exists(NOTES_FILE):
            with open(NOTES_FILE) as f:
                _notes_list = json.load(f)
    except Exception:
        _notes_list = []


def _save_notes():
    os.makedirs(os.path.dirname(NOTES_FILE), exist_ok=True)
    with open(NOTES_FILE, "w") as f:
        json.dump(_notes_list, f)


@app.route("/api/notes")
def api_notes():
    return jsonify(_notes_list)


@app.route("/api/notes", methods=["POST"])
def api_notes_create():
    data = request.json or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
    note = {
        "id": str(int(time.time() * 1000)),
        "text": text,
        "done": False,
        "created": time.time(),
    }
    _notes_list.append(note)
    _save_notes()
    return jsonify(note)


@app.route("/api/notes/<note_id>", methods=["PUT"])
def api_notes_update(note_id):
    data = request.json or {}
    for note in _notes_list:
        if note["id"] == note_id:
            if "done" in data:
                note["done"] = bool(data["done"])
            if "text" in data:
                note["text"] = data["text"]
            _save_notes()
            return jsonify(note)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/notes/<note_id>", methods=["DELETE"])
def api_notes_delete(note_id):
    global _notes_list
    _notes_list = [n for n in _notes_list if n["id"] != note_id]
    _save_notes()
    return jsonify({"ok": True})


# ── TV Remote API ────────────────────────────────────────────────────

_tv_remote = None
_tv_loop = None
_tv_pairing_remote = None

TV_IP = "10.10.20.194"
_TV_CERT_DIR = os.path.dirname(os.path.abspath(__file__))
_TV_CERTFILE = os.path.join(_TV_CERT_DIR, "tv_cert.pem")
_TV_KEYFILE = os.path.join(_TV_CERT_DIR, "tv_key.pem")

TV_KEYS = {
    "up": "DPAD_UP", "down": "DPAD_DOWN", "left": "DPAD_LEFT", "right": "DPAD_RIGHT",
    "select": "DPAD_CENTER", "back": "BACK", "home": "HOME",
    "play_pause": "MEDIA_PLAY_PAUSE", "rewind": "MEDIA_PREVIOUS", "forward": "MEDIA_NEXT",
    "power": "POWER", "volume_up": "VOLUME_UP", "volume_down": "VOLUME_DOWN", "mute": "VOLUME_MUTE",
}

TV_APPS = {
    "youtube": "com.google.android.youtube.tv",
    "netflix": "com.netflix.ninja",
    "prime": "https://app.primevideo.com",
    "crunchyroll": "crunchyroll://",
    "twitch": "tv.twitch.android.app",
    "plex": "com.plexapp.android",
}


def _ensure_tv_loop():
    """Create the asyncio event loop for TV operations if not already running."""
    global _tv_loop
    if _tv_loop and _tv_loop.is_running():
        return
    _tv_loop = asyncio.new_event_loop()

    def _run():
        asyncio.set_event_loop(_tv_loop)
        _tv_loop.run_forever()

    threading.Thread(target=_run, daemon=True).start()
    time.sleep(0.1)


def _tv_run(coro, timeout=10):
    """Run an async coroutine on the TV event loop from sync Flask context."""
    if not _tv_loop:
        _ensure_tv_loop()
    future = asyncio.run_coroutine_threadsafe(coro, _tv_loop)
    return future.result(timeout=timeout)


def init_tv_remote():
    """Try to connect to TV using existing certs."""
    global _tv_remote
    try:
        from androidtvremote2 import AndroidTVRemote

        if not os.path.exists(_TV_CERTFILE) or not os.path.exists(_TV_KEYFILE):
            print("[tv] No cert files found — pair via the TV tab first")
            return

        _ensure_tv_loop()

        async def _connect():
            global _tv_remote
            remote = AndroidTVRemote(
                client_name="BMO",
                certfile=_TV_CERTFILE,
                keyfile=_TV_KEYFILE,
                host=TV_IP,
            )
            await remote.async_connect()
            _tv_remote = remote
            print(f"[tv] Connected to TV at {TV_IP}")

        _tv_run(_connect())
    except ImportError:
        print("[tv] androidtvremote2 not installed — TV remote disabled")
    except Exception as e:
        print(f"[tv] Connection failed: {e} — try pairing via the TV tab")


@app.route("/api/tv/status")
def api_tv_status():
    connected = _tv_remote is not None
    current_app = ""
    if _tv_remote:
        try:
            current_app = _tv_remote.current_app or ""
        except Exception:
            pass
    needs_pairing = not os.path.exists(_TV_CERTFILE)
    return jsonify({"connected": connected, "current_app": current_app, "needs_pairing": needs_pairing})


@app.route("/api/tv/pair/start", methods=["POST"])
def api_tv_pair_start():
    """Start pairing — TV will show a PIN code."""
    global _tv_pairing_remote
    try:
        from androidtvremote2 import AndroidTVRemote

        _ensure_tv_loop()

        async def _start():
            global _tv_pairing_remote
            remote = AndroidTVRemote(
                client_name="BMO",
                certfile=_TV_CERTFILE,
                keyfile=_TV_KEYFILE,
                host=TV_IP,
            )
            await remote.async_generate_cert_if_missing()
            await remote.async_start_pairing()
            _tv_pairing_remote = remote

        _tv_run(_start())
        return jsonify({"ok": True, "message": "Check your TV for a PIN code"})
    except Exception as e:
        print(f"[tv] Pairing start failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/tv/pair/finish", methods=["POST"])
def api_tv_pair_finish():
    """Finish pairing with the PIN shown on TV, then connect."""
    global _tv_remote, _tv_pairing_remote
    data = request.json or {}
    pin = data.get("pin", "")
    if not pin:
        return jsonify({"error": "No PIN provided"}), 400
    if not _tv_pairing_remote:
        return jsonify({"error": "No pairing in progress — start pairing first"}), 400

    try:
        async def _finish():
            global _tv_remote, _tv_pairing_remote
            await _tv_pairing_remote.async_finish_pairing(pin)
            await _tv_pairing_remote.async_connect()
            _tv_remote = _tv_pairing_remote
            _tv_pairing_remote = None

        _tv_run(_finish())
        print(f"[tv] Paired and connected to TV at {TV_IP}!")
        return jsonify({"ok": True, "message": "Paired and connected!"})
    except Exception as e:
        _tv_pairing_remote = None
        print(f"[tv] Pairing finish failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/tv/key", methods=["POST"])
def api_tv_key():
    data = request.json or {}
    key = data.get("key", "")
    mapped = TV_KEYS.get(key, key)
    if _tv_remote:
        try:
            _tv_remote.send_key_command(mapped)
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "TV not connected — pair first"}), 503


@app.route("/api/tv/launch", methods=["POST"])
def api_tv_launch():
    data = request.json or {}
    app_name = data.get("app", "")
    url = TV_APPS.get(app_name, "")
    if not url:
        return jsonify({"error": f"Unknown app: {app_name}"}), 400
    if _tv_remote:
        try:
            _tv_remote.send_launch_app_command(url)
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "TV not connected — pair first"}), 503


@app.route("/api/tv/volume", methods=["POST"])
def api_tv_volume():
    data = request.json or {}
    direction = data.get("direction", "up")
    key_map = {"up": "VOLUME_UP", "down": "VOLUME_DOWN", "mute": "VOLUME_MUTE"}
    key = key_map.get(direction, "VOLUME_UP")
    if _tv_remote:
        try:
            _tv_remote.send_key_command(key)
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "TV not connected — pair first"}), 503


@app.route("/api/tv/power", methods=["POST"])
def api_tv_power():
    if _tv_remote:
        try:
            _tv_remote.send_key_command("POWER")
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "TV not connected — pair first"}), 503


# ── Settings API ────────────────────────────────────────────────────

@app.route("/api/settings")
def api_settings():
    """Return full merged settings with secrets redacted."""
    from agents.settings import get_settings
    settings = get_settings()
    if not settings:
        return jsonify({"error": "Settings not initialized"}), 500
    return jsonify(settings.to_dict_redacted())


@app.route("/api/settings", methods=["POST"])
def api_settings_set():
    """Set a setting value. Body: {key, value, level?}."""
    from agents.settings import get_settings
    settings = get_settings()
    if not settings:
        return jsonify({"error": "Settings not initialized"}), 500

    data = request.json or {}
    key = data.get("key", "")
    value = data.get("value")
    level = data.get("level", "user")

    if not key:
        return jsonify({"error": "No key provided"}), 400

    settings.set(key, value, level=level)
    return jsonify({"success": True, "key": key, "value": value, "level": level})


@app.route("/api/settings/reload", methods=["POST"])
def api_settings_reload():
    """Force reload settings from disk."""
    from agents.settings import get_settings
    settings = get_settings()
    if not settings:
        return jsonify({"error": "Settings not initialized"}), 500
    settings.reload()
    return jsonify({"success": True})


@app.route("/api/config")
def api_config():
    """Expose non-secret config to the frontend (settings-backed)."""
    from agents.settings import get_settings
    settings = get_settings()
    if settings:
        maps_key = settings.get("services.maps_api_key", "")
    else:
        maps_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    return jsonify({"maps_api_key": maps_key})


# ── MCP API ─────────────────────────────────────────────────────────

@app.route("/api/mcp/servers")
def api_mcp_servers():
    """List all MCP servers with connection status."""
    if agent and agent.orchestrator and agent.orchestrator.mcp_manager:
        return jsonify(agent.orchestrator.mcp_manager.get_status())
    return jsonify({"servers": {}, "total_tools": 0, "connected": 0, "total": 0})


@app.route("/api/mcp/servers", methods=["POST"])
def api_mcp_servers_add():
    """Add a new MCP server. Body: {name, config}."""
    data = request.json or {}
    name = data.get("name", "")
    config = data.get("config", {})
    if not name or not config:
        return jsonify({"error": "name and config required"}), 400

    if agent and agent.orchestrator:
        if not agent.orchestrator.mcp_manager:
            from agents.mcp_manager import McpManager
            agent.orchestrator.mcp_manager = McpManager(agent.settings)

        success = agent.orchestrator.mcp_manager.add_server(name, config)
        return jsonify({"success": success, "name": name})
    return jsonify({"error": "Agent not initialized"}), 500


@app.route("/api/mcp/servers/<name>", methods=["DELETE"])
def api_mcp_servers_remove(name):
    """Remove an MCP server."""
    if agent and agent.orchestrator and agent.orchestrator.mcp_manager:
        agent.orchestrator.mcp_manager.remove_server(name)
        return jsonify({"success": True})
    return jsonify({"error": "MCP not initialized"}), 500


@app.route("/api/mcp/connect", methods=["POST"])
def api_mcp_connect():
    """Connect/reconnect an MCP server. Body: {server}."""
    data = request.json or {}
    server = data.get("server", "")
    if not server:
        return jsonify({"error": "server name required"}), 400

    if agent and agent.orchestrator and agent.orchestrator.mcp_manager:
        success = agent.orchestrator.mcp_manager.connect_server(server)
        return jsonify({"success": success})
    return jsonify({"error": "MCP not initialized"}), 500


@app.route("/api/mcp/disconnect", methods=["POST"])
def api_mcp_disconnect():
    """Disconnect an MCP server. Body: {server}."""
    data = request.json or {}
    server = data.get("server", "")
    if not server:
        return jsonify({"error": "server name required"}), 400

    if agent and agent.orchestrator and agent.orchestrator.mcp_manager:
        success = agent.orchestrator.mcp_manager.disconnect_server(server)
        return jsonify({"success": success})
    return jsonify({"error": "MCP not initialized"}), 500


@app.route("/api/mcp/tools")
def api_mcp_tools():
    """List all MCP tools."""
    if agent and agent.orchestrator and agent.orchestrator.mcp_manager:
        tools = agent.orchestrator.mcp_manager.get_all_tools()
        return jsonify({"tools": tools})
    return jsonify({"tools": []})


@app.route("/api/mcp/tools/<path:name>/call", methods=["POST"])
def api_mcp_tool_call(name):
    """Call an MCP tool directly. Body: {args: {}}."""
    data = request.json or {}
    args = data.get("args", {})

    if agent and agent.orchestrator and agent.orchestrator.mcp_manager:
        result = agent.orchestrator.mcp_manager.dispatch_tool(name, args)
        return jsonify(result)
    return jsonify({"error": "MCP not initialized"}), 500


# ── Custom Commands API ─────────────────────────────────────────────

@app.route("/api/commands")
def api_commands():
    """List available custom commands."""
    try:
        from agents.custom_commands import list_commands
        commands = list_commands(os.getcwd())
        return jsonify({"commands": commands})
    except ImportError:
        return jsonify({"commands": []})


@app.route("/api/commands/<name>", methods=["POST"])
def api_commands_execute(name):
    """Execute a custom command. Body: {args: ""}."""
    data = request.json or {}
    args = data.get("args", "")

    try:
        from agents.custom_commands import discover_commands, load_command
        commands = discover_commands(os.getcwd())

        if name not in commands:
            return jsonify({"error": f"Command not found: {name}"}), 404

        expanded = load_command(commands[name], args)
        result = agent.chat(expanded)
        return jsonify(result)
    except ImportError:
        return jsonify({"error": "Custom commands not available"}), 500


# ── Memory API ──────────────────────────────────────────────────────

@app.route("/api/memory")
def api_memory():
    """Read auto-memory for the current project."""
    try:
        from agents.memory import load_memory, get_memory_path
        content = load_memory(os.getcwd())
        path = get_memory_path(os.getcwd())
        return jsonify({"content": content, "path": path})
    except ImportError:
        return jsonify({"content": "", "path": ""})


@app.route("/api/memory", methods=["POST"])
def api_memory_write():
    """Write to auto-memory. Body: {section, content}."""
    data = request.json or {}
    section = data.get("section", "Notes")
    content = data.get("content", "")

    if not content:
        return jsonify({"error": "No content provided"}), 400

    try:
        from agents.memory import update_memory_section
        update_memory_section(os.getcwd(), section, content)
        return jsonify({"success": True})
    except ImportError:
        return jsonify({"error": "Memory module not available"}), 500


@app.route("/api/memory", methods=["DELETE"])
def api_memory_clear():
    """Clear auto-memory for the current project."""
    try:
        from agents.memory import clear_memory
        cleared = clear_memory(os.getcwd())
        return jsonify({"success": True, "cleared": cleared})
    except ImportError:
        return jsonify({"error": "Memory module not available"}), 500


# ── Compact API ─────────────────────────────────────────────────────

@app.route("/api/chat/compact", methods=["POST"])
def api_chat_compact():
    """Compact conversation history."""
    if agent:
        msg = agent.compact()
        return jsonify({"success": True, "message": msg, "history_length": len(agent.conversation_history)})
    return jsonify({"error": "Agent not initialized"}), 500


# ── WebSocket Events ────────────────────────────────────────────────

@socketio.on("connect")
def on_connect(auth=None):
    print("[ws] Client connected")
    # Send initial state for available services — wrapped in try/except
    # so a failing service doesn't kill the WebSocket connection
    try:
        if weather:
            socketio.emit("weather_update", weather.get_current())
    except Exception as e:
        print(f"[ws] Weather init failed: {e}")
    try:
        if music:
            socketio.emit("music_state", music.get_state())
    except Exception as e:
        print(f"[ws] Music init failed: {e}")
    try:
        if timers:
            socketio.emit("timers_tick", timers.get_all())
    except Exception as e:
        print(f"[ws] Timers init failed: {e}")
    try:
        if calendar:
            next_event = calendar.get_next_event()
            if next_event:
                socketio.emit("next_event", next_event)
    except Exception as e:
        print(f"[ws] Calendar init failed: {e}")


@socketio.on("chat_message")
def on_chat_message(data):
    from flask_socketio import emit
    message = data.get("message", "")
    speaker = data.get("speaker", "unknown")

    try:
        # Save user message immediately
        _save_chat_message({"role": "user", "text": message, "speaker": speaker, "ts": time.time()})

        emit("status", {"state": "thinking"})

        result = agent.chat(message, speaker=speaker)

        emit("status", {"state": "yapping"})

        # Save assistant response immediately
        _save_chat_message({"role": "assistant", "text": result["text"], "ts": time.time()})

        emit("chat_response", result)  # emit() sends only to sender, not broadcast

        # Speak the response
        if voice:
            threading.Thread(target=voice.speak, args=(result["text"],), daemon=True).start()
    except Exception as e:
        print(f"[chat] ERROR in chat_message handler: {e}")
        import traceback
        traceback.print_exc()
        emit("chat_response", {"text": f"Something went wrong: {e}", "speaker": speaker, "commands_executed": []})


@socketio.on("scratchpad_read")
def on_scratchpad_read(data):
    """Read scratchpad sections for the web UI."""
    from flask_socketio import emit
    if agent and agent.orchestrator:
        sections = agent.orchestrator.scratchpad.to_dict()
        emit("scratchpad_update", sections)


@socketio.on("scratchpad_write")
def on_scratchpad_write(data):
    """Write to scratchpad from the web UI."""
    from flask_socketio import emit
    if agent and agent.orchestrator:
        section = data.get("section", "Notes")
        content = data.get("content", "")
        append = data.get("append", False)
        agent.orchestrator.scratchpad.write(section, content, append)
        emit("scratchpad_update", agent.orchestrator.scratchpad.to_dict())


@socketio.on("scratchpad_clear")
def on_scratchpad_clear(data):
    """Clear scratchpad section(s) from the web UI."""
    from flask_socketio import emit
    if agent and agent.orchestrator:
        section = data.get("section")  # None = clear all
        agent.orchestrator.scratchpad.clear(section)
        emit("scratchpad_update", agent.orchestrator.scratchpad.to_dict())


@socketio.on("disconnect")
def on_disconnect():
    print("[ws] Client disconnected")


# ── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_services()
    print("[bmo] BMO is ready! Access at http://0.0.0.0:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
