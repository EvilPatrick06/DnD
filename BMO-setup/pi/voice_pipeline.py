"""BMO Voice Pipeline — Cloud STT/TTS with local fallback.

Routes STT to Groq Whisper and TTS to edge-tts (fast) or Fish Audio (premium).
Falls back to local Whisper-base and Piper TTS when cloud APIs are unreachable.
Wake word detection always runs locally (must be instant).
"""

import asyncio
import io
import os
import pickle
import queue
import re
import subprocess
import tempfile
import threading
import time
import wave

import edge_tts
import numpy as np
import requests
import sounddevice as sd

from cloud_providers import groq_stt, fish_audio_tts

MODELS_DIR = os.path.expanduser("~/bmo/models")
DATA_DIR = os.path.expanduser("~/bmo/data")
VOICE_PROFILES_PATH = os.path.join(DATA_DIR, "voice_profiles.pkl")

EDGE_TTS_VOICE = "en-US-AnaNeural"  # Young/playful voice for BMO

SAMPLE_RATE = 16000
CHANNELS = 1
SILENCE_THRESHOLD = 2500      # RMS threshold for silence detection (ambient ~2000 with TV/fans)
SILENCE_DURATION = 0.8        # Seconds of silence to stop recording
MAX_RECORD_SECONDS = 10       # Max recording length
WAKE_WORDS = ["hey_jarvis"]   # openwakeword fallback model
WAKE_PHRASE = "bmo"           # actual phrase to listen for via STT
# Only close phonetic matches — no common English words that cause false triggers
WAKE_VARIANTS = {"bmo", "beemo", "bemo", "beamo", "b.m.o", "bimo",
                 "vemo", "beema", "bima", "pmo", "beo", "bee mo", "be mo"}
# Removed: demo, nemo, primo, remo, bingo, bino — too common in normal speech

def _get_wake_model_paths() -> list[str]:
    """Resolve wake word names to full ONNX model paths."""
    import openwakeword
    model_dir = os.path.join(os.path.dirname(openwakeword.__file__), "resources", "models")
    paths = []
    for name in WAKE_WORDS:
        for candidate in [f"{name}.onnx", f"{name}_v0.1.onnx"]:
            full = os.path.join(model_dir, candidate)
            if os.path.isfile(full):
                paths.append(full)
                break
    return paths

# Local Piper TTS config (fallback)
PIPER_MODEL = os.path.join(MODELS_DIR, "piper", "en_US-hfc_female-medium.onnx")
PITCH_SHIFT = 400  # Semitone-cents to raise pitch for BMO voice


def _check_cloud() -> bool:
    """Quick check if cloud APIs are reachable."""
    try:
        from agent import _check_cloud_available
        return _check_cloud_available()
    except ImportError:
        try:
            r = requests.get("https://generativelanguage.googleapis.com/", timeout=3)
            return True
        except Exception:
            return False


class VoicePipeline:
    """Handles wake word detection, speech-to-text, text-to-speech, and speaker ID.

    STT is routed to Groq Whisper API, TTS to Fish Audio cloud API.
    Falls back to local models (Whisper-base, Piper) when cloud is unreachable.
    Wake word detection always runs locally for instant response.
    """

    def __init__(self, socketio=None, chat_callback=None):
        self.socketio = socketio
        self._chat_callback = chat_callback
        self._running = False
        self._listen_thread = None

        # Lazy-loaded LOCAL models (fallback only)
        self._whisper = None
        self._wake_model = None
        self._speaker_encoder = None
        self._voice_profiles = {}

        # Audio state
        self._audio_queue = queue.Queue()

    # ── Model Loading (local fallback models) ─────────────────────────

    def _load_whisper(self):
        if self._whisper is None:
            from faster_whisper import WhisperModel
            self._whisper = WhisperModel("base", device="cpu", compute_type="int8")
        return self._whisper

    def _load_wake_model(self):
        if self._wake_model is None:
            from openwakeword.model import Model
            self._wake_model = Model(wakeword_model_paths=_get_wake_model_paths())
        return self._wake_model

    def _load_speaker_encoder(self):
        if self._speaker_encoder is None:
            from resemblyzer import VoiceEncoder
            self._speaker_encoder = VoiceEncoder()
        return self._speaker_encoder

    def _load_voice_profiles(self):
        if os.path.exists(VOICE_PROFILES_PATH):
            with open(VOICE_PROFILES_PATH, "rb") as f:
                self._voice_profiles = pickle.load(f)
        return self._voice_profiles

    # ── Wake Word Detection (always local — must be instant) ──────────

    def start_listening(self):
        """Start the background wake word listener."""
        if self._running:
            return
        self._running = True
        self._listen_thread = threading.Thread(target=self._wake_word_loop, daemon=True)
        self._listen_thread.start()

    def stop_listening(self):
        """Stop the background listener."""
        self._running = False

    def _wake_word_loop(self):
        """Listen for 'hey bmo' using energy-based VAD + quick STT check."""
        chunk_size = 1280  # 80ms at 16kHz
        ring_buffer = []   # rolling 2-second buffer
        max_ring_chunks = int(2.0 * SAMPLE_RATE / chunk_size)  # ~2s of audio
        energy_threshold = 5000  # RMS energy — lowered for mic gain 35/62 (was 8000 at gain 62)
        cooldown_until = 0.0
        consecutive_active = 0
        ACTIVE_CHUNKS_NEEDED = 5  # ~400ms of sustained loud speech before checking

        print("[wake] Listening for 'hey BMO'...")
        self._wake_triggered = False
        while self._running:
            try:
                self._wake_listen_cycle(
                    chunk_size, ring_buffer, max_ring_chunks,
                    energy_threshold, cooldown_until, consecutive_active,
                    ACTIVE_CHUNKS_NEEDED,
                )
                # Stream is now closed — safe to handle wake
                if self._wake_triggered:
                    self._wake_triggered = False
                    time.sleep(0.2)  # let ALSA release the device
                    self._on_wake()
            except Exception as e:
                print(f"[wake] Listener error: {e}, restarting in 2s...")
                time.sleep(2)

    def _wake_listen_cycle(self, chunk_size, ring_buffer, max_ring_chunks,
                           energy_threshold, cooldown_until, consecutive_active,
                           active_needed):
        """One cycle of wake word listening. Exits when wake detected."""
        def audio_callback(indata, frames, time_info, status):
            if status:
                print(f"[audio] {status}")
            self._audio_queue.put(indata.copy())

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16",
            blocksize=chunk_size,
            callback=audio_callback,
        ) as stream:
            while self._running:
                try:
                    chunk = self._audio_queue.get(timeout=1.0)
                except queue.Empty:
                    continue

                # Maintain rolling buffer
                ring_buffer.append(chunk)
                if len(ring_buffer) > max_ring_chunks:
                    ring_buffer.pop(0)

                # Check energy level
                rms = np.sqrt(np.mean(chunk.astype(np.float32) ** 2))
                if rms > energy_threshold:
                    consecutive_active += 1
                else:
                    consecutive_active = 0
                    continue

                now = time.time()
                if consecutive_active < active_needed or now < cooldown_until:
                    continue

                # Grab last ~2s of audio and run quick STT
                audio_bytes = np.concatenate(ring_buffer).tobytes()
                cooldown_until = now + 4.0
                consecutive_active = 0

                try:
                    wav_buf = self._pcm_to_wav(audio_bytes)
                    text = self._quick_stt(wav_buf)
                    text_lower = (text or "").lower().strip()
                    print(f"[wake] STT check: '{text_lower}'")
                    has_bmo = any(
                        re.search(r'\b' + re.escape(v) + r'\b', text_lower)
                        for v in WAKE_VARIANTS
                    )
                    # Require a greeting word near BMO to filter TV audio
                    has_greeting = bool(re.search(
                        r'\b(hey|hi|yo|okay|ok|oh)\b', text_lower
                    ))
                    word_count = len(text_lower.split())
                    # Accept: "hey bmo", "hi bmo", "yo bmo" (greeting + bmo)
                    # Accept: just "bmo" alone (1 word only — deliberate wake)
                    # Reject: TV sentences containing "bmo" without greeting
                    is_wake = has_bmo and (has_greeting or word_count <= 1)
                    if is_wake:
                        print(f"[wake] Detected 'hey BMO' in: {text}")
                        self._emit("status", {"state": "listening"})
                        ring_buffer.clear()
                        while not self._audio_queue.empty():
                            self._audio_queue.get_nowait()
                        # Exit the stream context first, then handle wake
                        self._wake_triggered = True
                        return
                except Exception as e:
                    print(f"[wake] STT check failed: {e}")

    def _pcm_to_wav(self, pcm_bytes: bytes) -> bytes:
        """Convert raw PCM to WAV format for STT."""
        import io, wave
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(pcm_bytes)
        return buf.getvalue()

    def _quick_stt(self, wav_bytes: bytes) -> str:
        """Quick STT for wake word detection — uses Groq Whisper."""
        try:
            from cloud_providers import groq_stt, GROQ_API_KEY
            if GROQ_API_KEY:
                result = groq_stt(wav_bytes, prompt="Hey BMO.")
                return result.get("text", "")
        except Exception:
            pass
        # Fallback to local whisper
        try:
            model = self._load_whisper()
            import tempfile, os
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(wav_bytes)
                tmp = f.name
            segments, _ = model.transcribe(tmp, language="en", beam_size=1,
                                           vad_filter=False)
            os.unlink(tmp)
            return " ".join(s.text for s in segments).strip()
        except Exception:
            return ""

    def _on_wake(self):
        """Called when wake word is detected. Records, transcribes, processes, then listens for follow-ups."""
        response_text = self._process_one_turn(is_follow_up=False)
        if not response_text:
            return

        # Enter follow-up conversation mode — no wake word needed
        self._follow_up_loop()

    def start_conversation(self):
        """Enter conversation mode programmatically (from alarms, notifications, etc.).

        Starts the follow-up loop in a background thread so the caller
        doesn't block.
        """
        if not self._running:
            return
        threading.Thread(target=self._follow_up_loop, daemon=True).start()

    def _process_one_turn(self, is_follow_up: bool = False) -> str | None:
        """Record, transcribe, get response, speak it. Returns response text or None."""
        audio_data = self.record_until_silence()
        if audio_data is None:
            self._emit("status", {"state": "idle"})
            return None

        # Save to temp file for processing
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._save_wav(f, audio_data)

        try:
            speaker = "unknown"

            # Transcribe
            self._emit("status", {"state": "thinking"})
            text = self.transcribe(temp_path)
            if not text or text.strip() == "":
                self._emit("status", {"state": "idle"})
                return None

            print(f"[stt] {speaker}: {text}")
            self._emit("transcription", {"speaker": speaker, "text": text})

            # Check for conversation-ending phrases (only during follow-ups)
            text_lower = text.lower().strip().rstrip(".")
            is_closing = text_lower in ("goodbye", "bye", "good night", "goodnight",
                              "that's all", "thanks bmo", "thank you bmo",
                              "never mind", "nevermind", "stop")
            if is_follow_up and is_closing:
                print("[conv] User ended conversation")
                if self._chat_callback:
                    response = self._chat_callback(text, speaker)
                    if response:
                        tts_text = self._strip_markdown(response)
                        print(f"[tts] Speaking: {tts_text[:80]}...")
                        self._emit("response", {"text": response, "speaker": speaker})
                        self.speak(tts_text)
                self._emit("status", {"state": "idle"})
                return ""  # empty string = responded but end conversation

            # Process through chat and speak response
            if self._chat_callback:
                response = self._chat_callback(text, speaker)
                if response:
                    tts_text = self._strip_markdown(response)
                    print(f"[tts] Speaking: {tts_text[:80]}...")
                    self._emit("response", {"text": response, "speaker": speaker})
                    self.speak(tts_text)
                    # Skip follow-up loop if user said a closing phrase on the first turn
                    if is_closing:
                        self._emit("status", {"state": "idle"})
                        return ""
                    return response
            return None
        except Exception as e:
            print(f"[wake] Response error: {e}")
            return None
        finally:
            os.unlink(temp_path)

    def listen_for_followup(self, timeout: float = 10.0):
        """Listen briefly for a user response after proactive speech.

        Opens a short listen window (default 10s) for a single response.
        Used after notifications, announcements, or other BMO-initiated speech.
        """
        if not self._running:
            return

        def _listen():
            self._emit("status", {"state": "follow_up"})
            heard = self._wait_for_speech(timeout)
            if heard:
                response = self._process_one_turn(is_follow_up=True)
                if response and response != "":
                    # Got a substantive response — enter full conversation mode
                    self._follow_up_loop()
                    return
            self._emit("status", {"state": "idle"})

        threading.Thread(target=_listen, daemon=True).start()

    def _follow_up_loop(self):
        """Listen for follow-up speech without wake word. Exits on silence or inactivity."""
        FOLLOW_UP_WAIT = 6.0  # seconds to wait for user to start speaking per turn
        BASE_TIMEOUT = 30.0   # inactivity timeout for first exchanges
        EXTENDED_TIMEOUT = 45.0  # extended timeout after 2+ exchanges
        import time as _time
        last_activity = _time.monotonic()
        exchange_count = 0

        self._emit("conversation_mode", {"active": True})

        while self._running:
            timeout = EXTENDED_TIMEOUT if exchange_count >= 2 else BASE_TIMEOUT
            print(f"[conv] Listening for follow-up (timeout={timeout}s, exchanges={exchange_count})...")
            self._emit("status", {"state": "follow_up"})

            # Wait for speech energy within the follow-up window
            heard_speech = self._wait_for_speech(FOLLOW_UP_WAIT)
            if not heard_speech:
                elapsed = _time.monotonic() - last_activity
                if elapsed >= timeout:
                    print("[conv] Inactivity timeout — back to wake word mode")
                    self._emit("status", {"state": "idle"})
                    self._emit("conversation_mode", {"active": False})
                    return
                # No speech this turn, but still within inactivity window — keep listening
                continue

            last_activity = _time.monotonic()

            # User started talking — process this turn
            response = self._process_one_turn(is_follow_up=True)
            if response is None:
                # No speech captured or empty transcription
                print("[conv] Empty turn — back to wake word mode")
                self._emit("status", {"state": "idle"})
                self._emit("conversation_mode", {"active": False})
                return
            if response == "":
                # User said goodbye — conversation ended
                self._emit("conversation_mode", {"active": False})
                return

            exchange_count += 1
            last_activity = _time.monotonic()
            # Response was spoken — loop back and listen for another follow-up

    def _wait_for_speech(self, timeout: float) -> bool:
        """Wait up to `timeout` seconds for speech energy. Returns True if speech detected."""
        chunk_size = 1280
        energy_threshold = 5000
        consecutive_active = 0
        needed = 3  # ~240ms of sustained speech

        def audio_callback(indata, frames, time_info, status):
            self._audio_queue.put(indata.copy())

        # Drain any leftover audio
        while not self._audio_queue.empty():
            self._audio_queue.get_nowait()

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16",
            blocksize=chunk_size,
            callback=audio_callback,
        ):
            start = time.time()
            while time.time() - start < timeout:
                try:
                    chunk = self._audio_queue.get(timeout=0.5)
                except queue.Empty:
                    continue
                rms = np.sqrt(np.mean(chunk.astype(np.float32) ** 2))
                if rms > energy_threshold:
                    consecutive_active += 1
                    if consecutive_active >= needed:
                        # Drain queue so record_until_silence starts clean
                        while not self._audio_queue.empty():
                            self._audio_queue.get_nowait()
                        return True
                else:
                    consecutive_active = 0
        return False

    @staticmethod
    def _strip_markdown(text: str) -> str:
        """Strip markdown formatting before TTS."""
        text = re.sub(r'\*+', '', text)
        text = re.sub(r'#+\s*', '', text)
        text = re.sub(r'`[^`]*`', lambda m: m.group(0).strip('`'), text)
        return text

    # ── Recording ────────────────────────────────────────────────────

    def record_until_silence(self) -> np.ndarray | None:
        """Record audio until silence is detected. Returns raw int16 numpy array."""
        chunks = []
        silence_start = None
        started_speaking = False
        print("[record] Recording...")

        def callback(indata, frames, time_info, status):
            chunks.append(indata.copy())

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16",
            callback=callback,
        ):
            start_time = time.time()
            while time.time() - start_time < MAX_RECORD_SECONDS:
                time.sleep(0.05)
                if not chunks:
                    continue

                # Check RMS of latest chunk
                latest = chunks[-1].flatten()
                rms = np.sqrt(np.mean(latest.astype(np.float32) ** 2))

                if rms > SILENCE_THRESHOLD:
                    started_speaking = True
                    silence_start = None
                elif started_speaking:
                    if silence_start is None:
                        silence_start = time.time()
                    elif time.time() - silence_start > SILENCE_DURATION:
                        break

        elapsed = time.time() - start_time
        print(f"[record] Done ({elapsed:.1f}s, {len(chunks)} chunks, spoke={started_speaking})")

        if not started_speaking:
            return None

        return np.concatenate(chunks)

    def record_clip(self, duration: float = 10.0) -> str:
        """Record a fixed-duration clip and save to a temp file. Returns file path."""
        frames = int(SAMPLE_RATE * duration)
        audio = sd.rec(frames, samplerate=SAMPLE_RATE, channels=CHANNELS, dtype="int16")
        sd.wait()

        path = os.path.join(DATA_DIR, f"clip_{int(time.time())}.wav")
        with open(path, "wb") as f:
            self._save_wav(f, audio)
        return path

    # ── Speech-to-Text (Groq Whisper → local fallback) ──────────────

    def transcribe(self, audio_path: str) -> str:
        """Transcribe audio file to text.

        Routes to Groq Whisper Large-v3 API for best accuracy.
        Falls back to local Whisper-base if cloud unreachable.
        """
        if _check_cloud():
            try:
                return self._cloud_transcribe(audio_path)
            except Exception as e:
                print(f"[stt] Cloud STT failed ({e}), falling back to local")

        return self._local_transcribe(audio_path)

    def _cloud_transcribe(self, audio_path: str) -> str:
        """Send audio to Groq Whisper API for transcription."""
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        result = groq_stt(audio_bytes)
        return result.get("text", "")

    def _local_transcribe(self, audio_path: str) -> str:
        """Transcribe with local Whisper-base model (CPU, lower accuracy)."""
        model = self._load_whisper()
        segments, _ = model.transcribe(audio_path, beam_size=5)
        return " ".join(seg.text.strip() for seg in segments)

    # ── Text-to-Speech (Fish Audio → local fallback) ────────────────

    def speak(self, text: str, speaker: str = "bmo_calm", emotion: str | None = None, volume: int | None = None):
        """Convert text to speech and play through speakers.

        Args:
            text: Text to speak
            speaker: Voice profile (e.g. 'bmo_happy', 'npc_gruff_dwarf')
            emotion: Override emotion for BMO voice (happy, calm, dramatic, etc.)
            volume: Playback volume 0-100 (default: None = use ffplay default)
        """
        self._emit("status", {"state": "speaking"})
        self._speak_volume = volume

        if emotion:
            speaker = f"bmo_{emotion}"

        try:
            try:
                self._cloud_speak(text, speaker)
                return
            except Exception as e:
                print(f"[tts] Fish Audio failed ({e}), trying edge-tts")

            try:
                self._edge_speak(text)
                return
            except Exception as e:
                print(f"[tts] edge-tts failed ({e}), falling back to local")

            self._local_speak(text)
        except Exception as e:
            print(f"[tts] All TTS failed: {e}")
        finally:
            self._emit("status", {"state": "idle"})

    def _play_audio(self, path: str):
        """Play an audio file through speakers via ffplay."""
        import os as _os
        file_size = _os.path.getsize(path)
        vol = getattr(self, "_speak_volume", None)
        vol_pct = f" @ {vol}%" if vol is not None else ""
        print(f"[tts] Playing {file_size} bytes via ffplay{vol_pct}...")
        env = os.environ.copy()
        env["XDG_RUNTIME_DIR"] = "/run/user/1000"
        cmd = ["ffplay", "-nodisp", "-autoexit", "-loglevel", "error"]
        if vol is not None:
            cmd += ["-volume", str(vol)]
        cmd.append(path)
        start = time.time()
        result = subprocess.run(
            cmd,
            capture_output=True, timeout=120, env=env,
        )
        elapsed = time.time() - start
        if result.returncode != 0:
            print(f"[tts] ffplay error (rc={result.returncode}, {elapsed:.1f}s): {result.stderr.decode().strip()}")
        else:
            print(f"[tts] Playback done ({elapsed:.1f}s)")

    def _edge_speak(self, text: str):
        """Generate speech via edge-tts (fast, free) and play locally."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            temp_path = f.name

        try:
            communicate = edge_tts.Communicate(text, EDGE_TTS_VOICE)
            asyncio.run(communicate.save(temp_path))
            self._play_audio(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def _split_tts_chunks(self, text: str, max_chars: int = 500) -> list[str]:
        """Split text into TTS-friendly chunks at sentence boundaries."""
        if len(text) <= max_chars:
            return [text]
        chunks = []
        current = ""
        # Split by sentence-ending punctuation
        sentences = re.split(r'(?<=[.!?])\s+', text)
        for sentence in sentences:
            if len(current) + len(sentence) + 1 <= max_chars:
                current = f"{current} {sentence}".strip() if current else sentence
            else:
                if current:
                    chunks.append(current)
                current = sentence
        if current:
            chunks.append(current)
        return chunks or [text]

    def _cloud_speak(self, text: str, speaker: str = "bmo_calm"):
        """Generate speech via Fish Audio API and play locally."""
        from cloud_providers import FISH_AUDIO_VOICE_ID
        chunks = self._split_tts_chunks(text)
        for i, chunk in enumerate(chunks):
            audio_bytes = fish_audio_tts(chunk, voice_id=FISH_AUDIO_VOICE_ID)
            if len(chunks) > 1:
                print(f"[tts] Got {len(audio_bytes)} bytes from Fish Audio (chunk {i+1}/{len(chunks)})")
            else:
                print(f"[tts] Got {len(audio_bytes)} bytes from Fish Audio")

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                f.flush()
                temp_path = f.name

            try:
                self._play_audio(temp_path)
            finally:
                os.unlink(temp_path)

    def _local_speak(self, text: str):
        """Generate speech with local Piper TTS + pitch shift (fallback)."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as raw_file:
            raw_path = raw_file.name

        pitched_path = raw_path.replace(".wav", "_pitched.wav")

        try:
            # Generate speech with Piper
            subprocess.run(
                ["piper", "--model", PIPER_MODEL, "--output_file", raw_path],
                input=text,
                text=True,
                capture_output=True,
                check=True,
            )

            # Pitch-shift up for BMO voice using sox
            subprocess.run(
                ["sox", raw_path, pitched_path, "pitch", str(PITCH_SHIFT)],
                capture_output=True,
                check=True,
            )

            # Play through speakers
            subprocess.run(["pw-play", pitched_path], capture_output=True, check=True)

        except FileNotFoundError:
            # Fallback: play without pitch shift if sox not available
            print("[tts] sox not found, playing without pitch shift")
            subprocess.run(["pw-play", raw_path], capture_output=True)
        finally:
            for p in (raw_path, pitched_path):
                if os.path.exists(p):
                    os.unlink(p)

    # ── Speaker Identification ───────────────────────────────────────

    def identify_speaker(self, audio_path: str) -> str:
        """Identify who is speaking from a voice clip."""
        profiles = self._load_voice_profiles()
        if not profiles:
            return "unknown"

        from resemblyzer import preprocess_wav

        encoder = self._load_speaker_encoder()
        wav = preprocess_wav(audio_path)
        embed = encoder.embed_utterance(wav)

        best_name = "unknown"
        best_score = 0.0

        for name, profile_embed in profiles.items():
            similarity = float(
                np.dot(embed, profile_embed)
                / (np.linalg.norm(embed) * np.linalg.norm(profile_embed))
            )
            if similarity > 0.75 and similarity > best_score:
                best_name = name
                best_score = similarity

        return best_name

    def enroll_speaker(self, name: str, audio_paths: list[str]):
        """Register a new speaker's voice profile from multiple audio clips."""
        from resemblyzer import preprocess_wav

        encoder = self._load_speaker_encoder()
        embeddings = []
        for path in audio_paths:
            wav = preprocess_wav(path)
            embeddings.append(encoder.embed_utterance(wav))

        avg_embed = np.mean(embeddings, axis=0)

        profiles = self._load_voice_profiles()
        profiles[name] = avg_embed

        os.makedirs(os.path.dirname(VOICE_PROFILES_PATH), exist_ok=True)
        with open(VOICE_PROFILES_PATH, "wb") as f:
            pickle.dump(profiles, f)

        print(f"[speaker] Enrolled '{name}' from {len(audio_paths)} clips")

    # ── Helpers ──────────────────────────────────────────────────────

    def _save_wav(self, file_obj, audio_data: np.ndarray):
        """Write numpy int16 array as a WAV file."""
        with wave.open(file_obj, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_data.tobytes())

    def _emit(self, event: str, data: dict):
        """Emit a SocketIO event if available."""
        if self.socketio:
            self.socketio.emit(event, data)
