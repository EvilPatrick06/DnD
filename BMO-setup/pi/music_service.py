"""BMO Music Service — YouTube Music search + yt-dlp streaming + VLC/Chromecast/laptop playback."""

import json
import os
import threading
import time

import vlc
from ytmusicapi import YTMusic

STREAM_URL_TTL = 18000  # 5 hours — re-extract before expiry
HISTORY_FILE = os.path.expanduser("~/bmo/data/music_history.json")
MAX_HISTORY = 100

# Valid output device names
OUTPUT_PI = "pi"       # Local VLC playback through Pi speakers
OUTPUT_TV = "tv"       # Chromecast to TV
OUTPUT_LAPTOP = "laptop"  # Stream URL exposed via Flask for web UI <audio> playback


class MusicService:
    """Manages music search, queue, and playback (local VLC + Chromecast + laptop streaming)."""

    def __init__(self, smart_home=None, socketio=None):
        self.smart_home = smart_home
        self.socketio = socketio

        # YT Music search
        self._ytmusic = YTMusic()

        # VLC player
        self._vlc_instance = vlc.Instance("--no-video", "--quiet")
        self._player = self._vlc_instance.media_player_new()

        # Playback state
        self.queue: list[dict] = []
        self.queue_index: int = -1
        self.current_song: dict | None = None
        self._output_device: str = OUTPUT_PI
        self.shuffle: bool = False
        self.repeat: str = "off"  # "off", "all", "one"

        # Auto-advance thread
        self._monitor_thread = None
        self._running = False

        # Pre-fetched next URL
        self._prefetch_url: str | None = None
        self._prefetch_index: int = -1

        # Laptop streaming state — the raw audio URL the web UI <audio> element plays
        self._laptop_stream_url: str | None = None

        # Play history
        self.history: list[dict] = []
        self._load_history()

    # ── Output Device Property ───────────────────────────────────────

    @property
    def output_device(self) -> str:
        return self._output_device

    @output_device.setter
    def output_device(self, value: str):
        """Validate and set the output device."""
        valid = {OUTPUT_PI, OUTPUT_TV, OUTPUT_LAPTOP}
        if value not in valid:
            print(f"[music] Invalid output device '{value}', keeping '{self._output_device}'")
            return
        self._output_device = value

    # ── Search ───────────────────────────────────────────────────────

    def search(self, query: str, limit: int = 20) -> list[dict]:
        """Search YouTube Music for songs."""
        results = self._ytmusic.search(query, filter="songs", limit=limit)
        return [self._format_result(r) for r in results if r.get("videoId")]

    @staticmethod
    def _format_result(item: dict) -> dict:
        artists = ", ".join(a["name"] for a in item.get("artists", []))
        thumbnails = item.get("thumbnails", [])
        thumbnail = thumbnails[-1]["url"] if thumbnails else ""
        return {
            "videoId": item["videoId"],
            "title": item.get("title", "Unknown"),
            "artist": artists,
            "album": item.get("album", {}).get("name", "") if item.get("album") else "",
            "duration": item.get("duration", ""),
            "thumbnail": thumbnail,
        }

    # ── Stream URL Extraction ────────────────────────────────────────

    @staticmethod
    def get_audio_stream_url(video_id: str) -> tuple[str, int]:
        """Extract the direct audio stream URL for a YouTube Music track. Returns (url, duration_sec)."""
        import yt_dlp

        opts = {
            "format": "bestaudio[ext=m4a]/bestaudio",
            "quiet": True,
            "no_warnings": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(
                f"https://music.youtube.com/watch?v={video_id}", download=False
            )
            return info["url"], info.get("duration", 0)

    # ── Playback Control ─────────────────────────────────────────────

    def play(self, song: dict | None = None, add_to_queue: bool = True):
        """Play a song. If song is None, resume current playback."""
        if song is None:
            # Resume
            if self._output_device == OUTPUT_PI:
                self._player.play()
            elif self._output_device == OUTPUT_TV:
                self._cast_play()
            elif self._output_device == OUTPUT_LAPTOP:
                # Laptop resumes by the web UI unpausing its <audio> element
                pass
            self._emit_state()
            return

        if add_to_queue:
            # Clear queue and start fresh, or append
            if self.queue_index == -1:
                self.queue = [song]
                self.queue_index = 0
            else:
                self.queue.append(song)
                self.queue_index = len(self.queue) - 1

        self.current_song = song

        # Get stream URL
        url, duration = self.get_audio_stream_url(song["videoId"])
        song["stream_url"] = url
        song["duration_sec"] = duration

        if self._output_device == OUTPUT_PI:
            media = self._vlc_instance.media_new(url)
            self._player.set_media(media)
            self._player.play()
        elif self._output_device == OUTPUT_TV:
            self._cast_play_media(song)
        elif self._output_device == OUTPUT_LAPTOP:
            # Store the stream URL — web UI polls get_state() and plays via <audio>
            self._laptop_stream_url = url
            print(f"[music] Laptop stream ready: {song.get('title', '?')}")

        self._record_play(song)
        self._start_monitor()
        self._prefetch_next()
        self._emit_state()

    def play_queue(self, songs: list[dict]):
        """Replace the queue and start playing from the beginning."""
        self.queue = songs
        self.queue_index = 0
        if songs:
            self.play(songs[0], add_to_queue=False)

    def pause(self):
        """Toggle pause/resume."""
        if self._output_device == OUTPUT_PI:
            self._player.pause()
        elif self._output_device == OUTPUT_TV:
            self._cast_pause()
        elif self._output_device == OUTPUT_LAPTOP:
            # Laptop pause/resume is handled by the web UI <audio> element
            pass
        self._emit_state()

    def stop(self):
        """Stop playback on the current output device."""
        self._stop_current_device()
        self.current_song = None
        self._emit_state()

    def _stop_current_device(self):
        """Stop playback on whatever device is currently active, without clearing song state."""
        if self._output_device == OUTPUT_PI:
            self._player.stop()
        elif self._output_device == OUTPUT_TV:
            self._cast_stop()
        elif self._output_device == OUTPUT_LAPTOP:
            self._laptop_stream_url = None

    def next_track(self):
        """Skip to next track in queue."""
        if not self.queue:
            return

        if self.shuffle:
            import random
            self.queue_index = random.randint(0, len(self.queue) - 1)
        else:
            self.queue_index += 1

        if self.queue_index >= len(self.queue):
            if self.repeat == "all":
                self.queue_index = 0
            else:
                self.stop()
                return

        self.play(self.queue[self.queue_index], add_to_queue=False)

    def previous_track(self):
        """Go to previous track in queue."""
        if not self.queue:
            return
        self.queue_index = max(0, self.queue_index - 1)
        self.play(self.queue[self.queue_index], add_to_queue=False)

    def seek(self, position_sec: float):
        """Seek to a position in seconds."""
        if self._output_device == OUTPUT_PI:
            self._player.set_time(int(position_sec * 1000))
        elif self._output_device == OUTPUT_TV:
            self._cast_seek(position_sec)
        elif self._output_device == OUTPUT_LAPTOP:
            # Laptop seek is handled by the web UI <audio> element
            pass
        self._emit_state()

    def set_volume(self, volume: int):
        """Set volume (0-100)."""
        if self._output_device == OUTPUT_PI:
            self._player.audio_set_volume(volume)
        elif self._output_device == OUTPUT_TV:
            if self.smart_home:
                self.smart_home.set_volume(self._output_device, volume / 100.0)
        elif self._output_device == OUTPUT_LAPTOP:
            # Laptop volume is controlled by the web UI <audio> element
            pass

    # ── Output Device ────────────────────────────────────────────────

    def set_output_device(self, device: str):
        """Switch output between 'pi', 'tv', and 'laptop'.

        Stops playback on the current device. If a song was playing,
        resumes it on the new device automatically.
        """
        if device == self._output_device:
            return

        valid = {OUTPUT_PI, OUTPUT_TV, OUTPUT_LAPTOP}
        if device not in valid:
            print(f"[music] Invalid device '{device}', ignoring")
            return

        was_playing = self.current_song is not None
        song_to_resume = self.current_song

        # Stop playback on the OLD device without clearing current_song
        self._stop_current_device()

        old_device = self._output_device
        self._output_device = device
        print(f"[music] Output switched: {old_device} → {device}")

        # Resume on the new device if something was playing
        if was_playing and song_to_resume:
            self.current_song = song_to_resume
            self.play(song_to_resume, add_to_queue=False)
        else:
            self._emit_state()

    def get_devices(self) -> list[dict]:
        """List available output devices."""
        return [
            {"name": OUTPUT_PI, "label": "Pi Speakers"},
            {"name": OUTPUT_TV, "label": "TV (Chromecast)"},
            {"name": OUTPUT_LAPTOP, "label": "Laptop (Web UI)"},
        ]

    def get_laptop_stream_url(self) -> str | None:
        """Return the current audio stream URL for the web UI <audio> element.

        Only relevant when output_device is 'laptop'. The web UI polls this
        via GET /api/music/stream-url and sets it as the <audio> src.
        """
        if self._output_device != OUTPUT_LAPTOP:
            return None
        return self._laptop_stream_url

    # ── State ────────────────────────────────────────────────────────

    def get_state(self) -> dict:
        """Get current playback state."""
        position = 0
        duration = 0
        is_playing = False

        if self._output_device == OUTPUT_PI:
            state = self._player.get_state()
            is_playing = state == vlc.State.Playing
            position = max(0, self._player.get_time()) / 1000
            duration = max(0, self._player.get_length()) / 1000
            if duration == 0 and self.current_song:
                duration = self.current_song.get("duration_sec", 0)
        elif self._output_device == OUTPUT_TV:
            is_playing = self.current_song is not None
            # Cast state would come from PyChromecast media controller
            if self.current_song:
                duration = self.current_song.get("duration_sec", 0)
        elif self._output_device == OUTPUT_LAPTOP:
            is_playing = self._laptop_stream_url is not None and self.current_song is not None
            if self.current_song:
                duration = self.current_song.get("duration_sec", 0)

        state_dict = {
            "song": self.current_song,
            "is_playing": is_playing,
            "position": round(position, 1),
            "duration": round(duration, 1),
            "volume": self._player.audio_get_volume() if self._output_device == OUTPUT_PI else 50,
            "output_device": self._output_device,
            "queue_length": len(self.queue),
            "queue_index": self.queue_index,
            "shuffle": self.shuffle,
            "repeat": self.repeat,
        }

        # Include stream URL when in laptop mode so the web UI can play it
        if self._output_device == OUTPUT_LAPTOP and self._laptop_stream_url:
            state_dict["stream_url"] = self._laptop_stream_url

        return state_dict

    # ── Chromecast Helpers ───────────────────────────────────────────

    def _get_tv_cast(self):
        """Resolve the 'tv' output device to a PyChromecast instance.

        Uses the first discovered Chromecast device. Returns None if
        smart_home is unavailable or no devices have been discovered.
        """
        if not self.smart_home:
            return None
        devices = self.smart_home.get_devices()
        if not devices:
            print("[music] No Chromecast devices found for TV output")
            return None
        return self.smart_home.get_cast(devices[0]["name"])

    def _cast_play_media(self, song: dict):
        cast = self._get_tv_cast()
        if cast:
            mc = cast.media_controller
            mc.play_media(
                song["stream_url"],
                "audio/mp4",
                title=song.get("title", ""),
                thumb=song.get("thumbnail", ""),
            )
            mc.block_until_active(timeout=10)

    def _cast_play(self):
        cast = self._get_tv_cast()
        if cast:
            cast.media_controller.play()

    def _cast_pause(self):
        cast = self._get_tv_cast()
        if cast:
            cast.media_controller.pause()

    def _cast_stop(self):
        cast = self._get_tv_cast()
        if cast:
            cast.media_controller.stop()

    def _cast_seek(self, position_sec: float):
        cast = self._get_tv_cast()
        if cast:
            cast.media_controller.seek(position_sec)

    # ── Auto-Advance Monitor ────────────────────────────────────────

    def _start_monitor(self):
        if self._running:
            return
        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def _monitor_loop(self):
        """Watch for track end and auto-advance."""
        while self._running:
            if self._output_device == OUTPUT_PI:
                state = self._player.get_state()
                if state == vlc.State.Ended:
                    if self.repeat == "one":
                        self.play(self.current_song, add_to_queue=False)
                    else:
                        self.next_track()
            # TV and laptop auto-advance is handled by their respective clients
            # (Chromecast media controller / web UI 'ended' event via WebSocket)
            time.sleep(1)

    def _prefetch_next(self):
        """Pre-fetch the next song's stream URL in a background thread."""
        next_idx = self.queue_index + 1
        if next_idx >= len(self.queue):
            return

        def _fetch():
            try:
                song = self.queue[next_idx]
                url, dur = self.get_audio_stream_url(song["videoId"])
                song["stream_url"] = url
                song["duration_sec"] = dur
                self._prefetch_url = url
                self._prefetch_index = next_idx
            except Exception:
                pass

        threading.Thread(target=_fetch, daemon=True).start()

    # ── Queue Management ─────────────────────────────────────────────

    def add_to_queue(self, song: dict):
        """Append a song to the queue without disrupting playback."""
        clean = {k: v for k, v in song.items() if not k.startswith("_")}
        self.queue.append(clean)
        self._emit_state()

    def remove_from_queue(self, index: int) -> bool:
        """Remove a song from the queue by visible index (relative to current)."""
        real_index = index + max(0, self.queue_index)
        if real_index == self.queue_index:
            return False  # Can't remove currently playing
        if 0 <= real_index < len(self.queue):
            self.queue.pop(real_index)
            if real_index < self.queue_index:
                self.queue_index -= 1
            self._emit_state()
            return True
        return False

    def get_queue(self) -> dict:
        """Return the visible queue (current + upcoming)."""
        visible = self.queue[self.queue_index:] if self.queue_index >= 0 else self.queue
        clean = [{k: v for k, v in s.items() if not k.startswith("_")} for s in visible]
        return {"queue": clean, "queue_index": 0}

    # ── History ──────────────────────────────────────────────────────

    def _load_history(self):
        try:
            if os.path.exists(HISTORY_FILE):
                with open(HISTORY_FILE, "r") as f:
                    self.history = json.load(f)[:MAX_HISTORY]
                print(f"[music] Loaded {len(self.history)} history entries")
        except Exception as e:
            print(f"[music] Failed to load history: {e}")
            self.history = []

    def _save_history(self):
        try:
            os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
            with open(HISTORY_FILE, "w") as f:
                json.dump(self.history[:MAX_HISTORY], f)
        except Exception as e:
            print(f"[music] Failed to save history: {e}")

    def _record_play(self, song: dict):
        """Record a song play in history."""
        clean = {k: v for k, v in song.items() if not k.startswith("_") and k != "stream_url"}
        if not self.history or self.history[0].get("song", {}).get("videoId") != clean.get("videoId"):
            self.history.insert(0, {"song": clean, "played_at": time.time()})
            if len(self.history) > MAX_HISTORY:
                self.history = self.history[:MAX_HISTORY]
            self._save_history()

    def get_history(self) -> list[dict]:
        """Return play history."""
        return self.history

    def get_most_played(self) -> list[dict]:
        """Return top songs by play count from history."""
        if not self.history:
            return []
        counts: dict[str, dict] = {}
        for entry in self.history:
            vid = entry.get("song", {}).get("videoId", "")
            if not vid:
                continue
            if vid not in counts:
                counts[vid] = {"song": entry["song"], "count": 0}
            counts[vid]["count"] += 1
        ranked = sorted(counts.values(), key=lambda x: x["count"], reverse=True)
        return [r["song"] for r in ranked[:4]]

    # ── Album / Playlist / Lyrics ────────────────────────────────────

    def get_album(self, browse_id: str) -> dict:
        """Get album tracks via ytmusic."""
        album = self._ytmusic.get_album(browse_id)
        tracks = []
        for t in album.get("tracks", []):
            tracks.append({
                "videoId": t.get("videoId", ""),
                "title": t.get("title", ""),
                "artist": ", ".join(a["name"] for a in t.get("artists", [])),
                "duration": t.get("duration", ""),
                "thumbnail": album.get("thumbnails", [{}])[-1].get("url", ""),
                "album": album.get("title", ""),
                "albumId": browse_id,
            })
        return {
            "title": album.get("title", ""),
            "artist": album.get("artists", [{}])[0].get("name", "") if album.get("artists") else "",
            "thumbnail": album.get("thumbnails", [{}])[-1].get("url", ""),
            "year": album.get("year", ""),
            "tracks": tracks,
        }

    def get_playlist(self, browse_id: str) -> dict:
        """Get playlist tracks via ytmusic."""
        pl = self._ytmusic.get_playlist(browse_id, limit=100)
        tracks = []
        for t in pl.get("tracks", []):
            if not t.get("videoId"):
                continue
            tracks.append({
                "videoId": t["videoId"],
                "title": t.get("title", ""),
                "artist": ", ".join(a["name"] for a in t.get("artists", [])),
                "duration": t.get("duration", ""),
                "thumbnail": t.get("thumbnails", [{}])[-1].get("url", ""),
            })
        return {
            "title": pl.get("title", ""),
            "artist": pl.get("author", {}).get("name", "") if pl.get("author") else "",
            "thumbnail": pl.get("thumbnails", [{}])[-1].get("url", ""),
            "year": pl.get("year", ""),
            "trackCount": pl.get("trackCount", len(tracks)),
            "tracks": tracks,
        }

    def search_playlists(self, query: str) -> list[dict]:
        """Search for community playlists."""
        results = self._ytmusic.search(query, filter="community_playlists", limit=20)
        formatted = []
        for r in results:
            browse_id = r.get("browseId") or r.get("playlistId")
            if not browse_id:
                continue
            if not browse_id.startswith("VL") and r.get("playlistId"):
                browse_id = "VL" + r["playlistId"]
            formatted.append({
                "browseId": browse_id,
                "title": r.get("title", ""),
                "author": r.get("author", ""),
                "itemCount": r.get("itemCount", ""),
                "thumbnail": r.get("thumbnails", [{}])[-1].get("url", ""),
            })
        return formatted

    def get_lyrics(self, video_id: str) -> dict:
        """Get lyrics for a track."""
        watch = self._ytmusic.get_watch_playlist(video_id)
        lyrics_browse_id = watch.get("lyrics")
        if not lyrics_browse_id:
            return {"lyrics": None, "error": "No lyrics available"}
        lyrics_data = self._ytmusic.get_lyrics(lyrics_browse_id)
        return {
            "lyrics": lyrics_data.get("lyrics", ""),
            "source": lyrics_data.get("source", ""),
        }

    # ── Helpers ──────────────────────────────────────────────────────

    def _emit_state(self):
        if self.socketio:
            self.socketio.emit("music_state", self.get_state())
