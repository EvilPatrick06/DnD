"""BMO Voice Pipeline — GPU-accelerated STT/TTS with local fallback.

Routes STT to GPU server (Whisper Large-v3) and TTS to GPU server (Fish Speech).
Falls back to local Whisper-base and Piper TTS when GPU server is unreachable.
Wake word detection always runs locally (must be instant).
"""

import io
import os
import pickle
import queue
import subprocess
import tempfile
import threading
import time
import wave

import numpy as np
import requests
import sounddevice as sd

MODELS_DIR = os.path.expanduser("~/bmo/models")
DATA_DIR = os.path.expanduser("~/bmo/data")
VOICE_PROFILES_PATH = os.path.join(DATA_DIR, "voice_profiles.pkl")

SAMPLE_RATE = 16000
CHANNELS = 1
SILENCE_THRESHOLD = 500       # RMS threshold for silence detection
SILENCE_DURATION = 1.5        # Seconds of silence to stop recording
MAX_RECORD_SECONDS = 30       # Max recording length
WAKE_WORDS = ["hey_jarvis"]   # Placeholder until custom "bmo" model is trained

# Local Piper TTS config (fallback)
PIPER_MODEL = os.path.join(MODELS_DIR, "piper", "en_US-hfc_female-medium.onnx")
PITCH_SHIFT = 400  # Semitone-cents to raise pitch for BMO voice

# GPU server config (imported from agent module or env)
GPU_SERVER_URL = os.environ.get("GPU_SERVER_URL", "https://ai.yourdomain.com")
GPU_SERVER_KEY = os.environ.get("GPU_SERVER_KEY", "")


def _gpu_headers() -> dict:
    headers = {}
    if GPU_SERVER_KEY:
        headers["Authorization"] = f"Bearer {GPU_SERVER_KEY}"
    return headers


def _check_gpu() -> bool:
    """Quick check if GPU server is reachable."""
    try:
        from agent import _check_gpu_available
        return _check_gpu_available()
    except ImportError:
        try:
            r = requests.get(f"{GPU_SERVER_URL}/health", timeout=3, headers=_gpu_headers())
            return r.status_code == 200
        except Exception:
            return False


class VoicePipeline:
    """Handles wake word detection, speech-to-text, text-to-speech, and speaker ID.

    STT and TTS are routed to GPU server for higher quality (Whisper Large-v3, Fish Speech).
    Falls back to local models (Whisper-base, Piper) when GPU is unreachable.
    Wake word detection always runs locally for instant response.
    """

    def __init__(self, socketio=None):
        self.socketio = socketio
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
            self._wake_model = Model(wakeword_models=WAKE_WORDS, inference_framework="onnx")
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
        """Continuously listen for wake words."""
        model = self._load_wake_model()
        chunk_size = 1280  # 80ms at 16kHz

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
        ):
            while self._running:
                try:
                    chunk = self._audio_queue.get(timeout=1.0)
                except queue.Empty:
                    continue

                audio_float = chunk.flatten().astype(np.float32) / 32768.0
                prediction = model.predict(audio_float)

                for wake_word in WAKE_WORDS:
                    score = prediction.get(wake_word, 0)
                    if score > 0.5:
                        print(f"[wake] Detected: {wake_word} (score={score:.2f})")
                        self._emit("status", {"state": "listening"})
                        self._on_wake()
                        # Drain queue after processing
                        while not self._audio_queue.empty():
                            self._audio_queue.get_nowait()

    def _on_wake(self):
        """Called when wake word is detected. Records, transcribes, and processes."""
        audio_data = self.record_until_silence()
        if audio_data is None:
            self._emit("status", {"state": "idle"})
            return

        # Save to temp file for processing
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._save_wav(f, audio_data)

        try:
            # Identify speaker
            speaker = self.identify_speaker(temp_path)

            # Transcribe
            self._emit("status", {"state": "thinking"})
            text = self.transcribe(temp_path)
            if not text or text.strip() == "":
                self._emit("status", {"state": "idle"})
                return

            print(f"[stt] {speaker}: {text}")
            self._emit("transcription", {"speaker": speaker, "text": text})
        finally:
            os.unlink(temp_path)

    # ── Recording ────────────────────────────────────────────────────

    def record_until_silence(self) -> np.ndarray | None:
        """Record audio until silence is detected. Returns raw int16 numpy array."""
        chunks = []
        silence_start = None
        started_speaking = False

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

    # ── Speech-to-Text (GPU server → local fallback) ─────────────────

    def transcribe(self, audio_path: str) -> str:
        """Transcribe audio file to text.

        Routes to GPU server (Whisper Large-v3) for best accuracy.
        Falls back to local Whisper-base if GPU unreachable.
        """
        if _check_gpu():
            try:
                return self._gpu_transcribe(audio_path)
            except Exception as e:
                print(f"[stt] GPU STT failed ({e}), falling back to local")

        return self._local_transcribe(audio_path)

    def _gpu_transcribe(self, audio_path: str) -> str:
        """Send audio to GPU server for Whisper Large-v3 transcription."""
        with open(audio_path, "rb") as f:
            files = {"audio": ("audio.wav", f, "audio/wav")}
            r = requests.post(
                f"{GPU_SERVER_URL}/stt",
                files=files,
                headers=_gpu_headers(),
                timeout=30,
            )
        r.raise_for_status()
        return r.json().get("text", "")

    def _local_transcribe(self, audio_path: str) -> str:
        """Transcribe with local Whisper-base model (CPU, lower accuracy)."""
        model = self._load_whisper()
        segments, _ = model.transcribe(audio_path, beam_size=5)
        return " ".join(seg.text.strip() for seg in segments)

    # ── Text-to-Speech (GPU server → local fallback) ─────────────────

    def speak(self, text: str, speaker: str = "bmo_calm", emotion: str | None = None):
        """Convert text to speech and play through speakers.

        Routes to GPU server (Fish Speech, cloned BMO voice) for authentic BMO voice.
        Falls back to local Piper TTS with pitch shift if GPU unreachable.

        Args:
            text: Text to speak
            speaker: Fish Speech speaker profile (e.g. 'bmo_happy', 'npc_gruff_dwarf')
            emotion: Override emotion for BMO voice (happy, calm, dramatic, etc.)
        """
        self._emit("status", {"state": "speaking"})

        if emotion:
            speaker = f"bmo_{emotion}"

        try:
            if _check_gpu():
                try:
                    self._gpu_speak(text, speaker)
                    return
                except Exception as e:
                    print(f"[tts] GPU TTS failed ({e}), falling back to local")

            self._local_speak(text)
        finally:
            self._emit("status", {"state": "idle"})

    def _gpu_speak(self, text: str, speaker: str = "bmo_calm"):
        """Generate speech via GPU server (Fish Speech) and play locally."""
        r = requests.post(
            f"{GPU_SERVER_URL}/tts",
            json={"text": text, "speaker": speaker, "format": "wav"},
            headers={**_gpu_headers(), "Content-Type": "application/json"},
            timeout=30,
        )
        r.raise_for_status()

        # Save and play the audio
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(r.content)
            temp_path = f.name

        try:
            subprocess.run(["aplay", temp_path], capture_output=True, check=True)
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
            subprocess.run(["aplay", pitched_path], capture_output=True, check=True)

        except FileNotFoundError:
            # Fallback: play without pitch shift if sox not available
            print("[tts] sox not found, playing without pitch shift")
            subprocess.run(["aplay", raw_path], capture_output=True)
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
