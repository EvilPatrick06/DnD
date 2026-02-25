"""BMO Voice Personality — Emotion detection, expression tags, NPC voices, morning routine, battle music DJ.

Parses BMO response tags for hardware control (face, LED, sound, emotion, music, NPC voice).
Maps emotions to Fish Speech reference files. Provides morning greeting logic and
a D&D battle music DJ that sets mood-based playlists via MusicService.
"""

import re
import time

# ── NPC Voice Mapping (Fish Speech speaker reference files) ──────────

NPC_VOICES: dict[str, str] = {
    "gruff_dwarf": "npc_gruff_dwarf.wav",
    "mysterious_elf": "npc_mysterious_elf.wav",
    "booming_dragon": "npc_booming_dragon.wav",
    "whispery_rogue": "npc_whispery_rogue.wav",
    "elderly_wizard": "npc_elderly_wizard.wav",
    "cheerful_bard": "npc_cheerful_bard.wav",
    "stern_guard": "npc_stern_guard.wav",
    "tavern_keeper": "npc_tavern_keeper.wav",
}

# ── BMO Emotion Voice Mapping (Fish Speech emotion reference files) ──

BMO_EMOTIONS: dict[str, str] = {
    "happy": "bmo_happy.wav",
    "calm": "bmo_calm.wav",
    "dramatic": "bmo_dramatic.wav",
    "sleepy": "bmo_sleepy.wav",
    "excited": "bmo_excited.wav",
    "sassy": "bmo_sassy.wav",
    "sad": "bmo_sad.wav",
}

# Shorthand emotion tags that map to canonical emotion names
_EMOTION_ALIASES: dict[str, str] = {
    "happy": "happy",
    "calm": "calm",
    "dramatic": "dramatic",
    "sleepy": "sleepy",
    "excited": "excited",
    "sassy": "sassy",
    "sad": "sad",
    # Uppercase shorthand tags like [HAPPY], [DRAMATIC]
    "HAPPY": "happy",
    "CALM": "calm",
    "DRAMATIC": "dramatic",
    "SLEEPY": "sleepy",
    "EXCITED": "excited",
    "SASSY": "sassy",
    "SAD": "sad",
}


# ── Emotion Detection ────────────────────────────────────────────────

def detect_emotion(text: str) -> str | None:
    """Detect emotion from BMO response tags embedded in text.

    Scans for tags like [EMOTION:happy], [HAPPY], [DRAMATIC], etc.
    Returns the canonical emotion string, or None if no emotion tag found.

    Examples:
        >>> detect_emotion("[EMOTION:happy] Hi there!")
        'happy'
        >>> detect_emotion("[DRAMATIC] The dragon approaches!")
        'dramatic'
        >>> detect_emotion("Just a normal sentence.")
        None
    """
    # Check for explicit [EMOTION:xxx] tag
    match = re.search(r"\[EMOTION:(\w+)\]", text, re.IGNORECASE)
    if match:
        emotion = match.group(1).lower()
        if emotion in BMO_EMOTIONS:
            return emotion

    # Check for shorthand tags like [HAPPY], [DRAMATIC]
    for alias, canonical in _EMOTION_ALIASES.items():
        if f"[{alias}]" in text or f"[{alias.upper()}]" in text:
            return canonical

    return None


# ── Expression Tag Parser ────────────────────────────────────────────

# All recognized tag patterns: [TYPE:value]
_TAG_PATTERN = re.compile(
    r"\["
    r"(?P<type>FACE|LED|SOUND|EMOTION|MUSIC|NPC)"
    r":(?P<value>[^\]]+)"
    r"\]",
    re.IGNORECASE,
)

# Standalone emotion tags: [HAPPY], [DRAMATIC], etc.
_STANDALONE_EMOTION_PATTERN = re.compile(
    r"\[(?P<emotion>" + "|".join(re.escape(a) for a in _EMOTION_ALIASES) + r")\]",
    re.IGNORECASE,
)


def parse_response_tags(text: str) -> dict:
    """Extract all hardware control tags from a BMO response string.

    Parses tags like:
        [FACE:happy]     -> face expression change
        [LED:blue]       -> LED color change
        [SOUND:chime]    -> play sound effect
        [EMOTION:happy]  -> TTS emotion reference
        [MUSIC:combat]   -> music mood change
        [NPC:gruff_dwarf] -> NPC voice selection

    Returns a dict with:
        clean_text: str  -- original text with all tags stripped
        face: str | None
        led: str | None
        sound: str | None
        emotion: str | None
        music: str | None
        npc: str | None
    """
    result: dict = {
        "clean_text": text,
        "face": None,
        "led": None,
        "sound": None,
        "emotion": None,
        "music": None,
        "npc": None,
    }

    # Extract typed tags [TYPE:value]
    for match in _TAG_PATTERN.finditer(text):
        tag_type = match.group("type").lower()
        value = match.group("value").strip()
        result[tag_type] = value

    # Extract standalone emotion tags [HAPPY], [DRAMATIC], etc.
    for match in _STANDALONE_EMOTION_PATTERN.finditer(text):
        emotion_raw = match.group("emotion")
        canonical = _EMOTION_ALIASES.get(emotion_raw, _EMOTION_ALIASES.get(emotion_raw.upper()))
        if canonical and result["emotion"] is None:
            result["emotion"] = canonical

    # Strip all tags from the clean text
    clean = _TAG_PATTERN.sub("", text)
    clean = _STANDALONE_EMOTION_PATTERN.sub("", clean)
    # Collapse extra whitespace left behind by tag removal
    clean = re.sub(r"  +", " ", clean).strip()
    result["clean_text"] = clean

    return result


def get_speaker_file(npc: str | None = None, emotion: str | None = None) -> str:
    """Resolve the Fish Speech speaker reference WAV file name.

    Priority: NPC voice > BMO emotion > default calm BMO voice.

    Args:
        npc: NPC archetype name (e.g. 'gruff_dwarf')
        emotion: BMO emotion name (e.g. 'happy')

    Returns:
        File name like 'npc_gruff_dwarf.wav' or 'bmo_happy.wav'
    """
    if npc and npc in NPC_VOICES:
        return NPC_VOICES[npc]
    if emotion and emotion in BMO_EMOTIONS:
        return BMO_EMOTIONS[emotion]
    return BMO_EMOTIONS["calm"]


# ── Morning Routine ──────────────────────────────────────────────────

# Minimum seconds between greetings (4 hours)
_GREETING_COOLDOWN = 4 * 60 * 60


class MorningRoutine:
    """Handles BMO morning greetings and daily briefings.

    Tracks when a face was last seen to decide whether BMO should give
    a full greeting (after long absence) or just acknowledge (recent).
    """

    def __init__(self):
        self._last_seen_time: float = 0.0
        self._last_greeted_name: str | None = None

    def check_greeting(self, face_detected: bool, name: str | None = None) -> str | None:
        """Check if BMO should greet someone.

        Returns a greeting message if a known face is detected after a
        period of inactivity (_GREETING_COOLDOWN). Returns None if:
        - No face detected
        - Face was seen recently (within cooldown)
        - Same person already greeted this session

        Args:
            face_detected: Whether the camera detected a face
            name: Recognized person's name, or None for unknown face

        Returns:
            Greeting message string, or None
        """
        if not face_detected:
            return None

        now = time.time()
        elapsed = now - self._last_seen_time

        # Always update last-seen time
        self._last_seen_time = now

        # Not enough time has passed for a new greeting
        if elapsed < _GREETING_COOLDOWN:
            return None

        # Don't re-greet the same person in the same session
        if name and name == self._last_greeted_name and elapsed < _GREETING_COOLDOWN * 2:
            return None

        self._last_greeted_name = name

        if name:
            hour = time.localtime().tm_hour
            if hour < 12:
                time_greeting = "Good morning"
            elif hour < 17:
                time_greeting = "Good afternoon"
            else:
                time_greeting = "Good evening"
            return f"{time_greeting}, {name}! BMO is happy to see you!"

        return "Oh! Hello there! BMO sees a new friend!"

    def build_morning_briefing(self, weather_service=None, calendar_service=None) -> str:
        """Build a morning briefing message with weather and calendar data.

        Composes a natural-language summary like:
            "Good morning! Here's your day: It's 45F and partly cloudy.
             You have 2 events today: Standup at 9:00 AM, Lunch at 12:00 PM."

        Args:
            weather_service: WeatherService instance (or None to skip weather)
            calendar_service: CalendarService instance (or None to skip calendar)

        Returns:
            Briefing message string
        """
        parts: list[str] = []

        hour = time.localtime().tm_hour
        if hour < 12:
            parts.append("Good morning!")
        elif hour < 17:
            parts.append("Good afternoon!")
        else:
            parts.append("Good evening!")

        parts.append("Here's your day:")

        # Weather
        if weather_service:
            try:
                weather = weather_service.get_current()
                if weather and "error" not in weather:
                    temp = weather.get("temperature", "?")
                    desc = weather.get("description", "unknown")
                    feels = weather.get("feels_like", "?")
                    parts.append(f"It's {temp}F and {desc.lower()} (feels like {feels}F).")

                    # Check forecast for notable weather
                    forecast = weather.get("forecast", [])
                    if forecast:
                        today = forecast[0]
                        high = today.get("high", "?")
                        low = today.get("low", "?")
                        parts.append(f"Today's high is {high}F, low {low}F.")
            except Exception as e:
                print(f"[personality] Weather briefing failed: {e}")

        # Calendar
        if calendar_service:
            try:
                events = calendar_service.get_today_events()
                if events:
                    count = len(events)
                    event_word = "event" if count == 1 else "events"
                    summaries = []
                    for ev in events[:5]:  # Cap at 5 for brevity
                        name = ev.get("summary", "Untitled")
                        start = ev.get("start", "")
                        if start:
                            summaries.append(f"{name} at {start}")
                        else:
                            summaries.append(name)
                    parts.append(f"You have {count} {event_word} today: {', '.join(summaries)}.")
                else:
                    parts.append("Your calendar is clear today!")
            except Exception as e:
                print(f"[personality] Calendar briefing failed: {e}")

        return " ".join(parts)


# ── D&D Battle Music DJ ─────────────────────────────────────────────

class BattleMusicDJ:
    """Manages D&D mood-based music via YouTube Music search.

    Responds to [MUSIC:combat], [MUSIC:tavern], etc. tags from BMO's
    AI responses and sets the appropriate background music playlist.
    """

    MOOD_PLAYLISTS: dict[str, str] = {
        "combat": "epic battle music orchestral",
        "boss": "epic boss fight music",
        "exploration": "fantasy exploration ambient music",
        "tavern": "medieval tavern music",
        "mystery": "dark ambient dungeon music",
        "victory": "triumphant victory fanfare music",
        "rest": "calm campfire music ambient",
    }

    def __init__(self):
        self._current_mood: str | None = None

    @property
    def current_mood(self) -> str | None:
        """The currently active mood, or None if no mood is set."""
        return self._current_mood

    def set_mood(self, mood: str, music_service) -> bool:
        """Search YT Music for the mood's playlist and start playing.

        Skips if the requested mood is already active (avoids restarting
        the same playlist). Uses MusicService.search() to find tracks
        and MusicService.play_queue() to start playback.

        Args:
            mood: Mood name (e.g. 'combat', 'tavern', 'rest')
            music_service: MusicService instance to control playback

        Returns:
            True if mood was changed and music started, False otherwise
        """
        mood = mood.lower().strip()

        if mood == self._current_mood:
            print(f"[music-dj] Mood '{mood}' already active, skipping")
            return False

        query = self.MOOD_PLAYLISTS.get(mood)
        if not query:
            print(f"[music-dj] Unknown mood '{mood}', available: {list(self.MOOD_PLAYLISTS.keys())}")
            return False

        try:
            print(f"[music-dj] Setting mood: {mood} (searching: '{query}')")
            results = music_service.search(query, limit=10)
            if not results:
                print(f"[music-dj] No results for mood '{mood}'")
                return False

            music_service.play_queue(results)
            music_service.shuffle = True
            self._current_mood = mood
            print(f"[music-dj] Now playing: {mood} ({len(results)} tracks)")
            return True
        except Exception as e:
            print(f"[music-dj] Failed to set mood '{mood}': {e}")
            return False

    def clear_mood(self):
        """Reset the current mood (does not stop playback)."""
        self._current_mood = None
