"""Cloud API Providers — Gemini, Claude, Groq, Fish Audio, Google Vision.

Replaces GPU server with cloud API calls (Gemini, Claude, Groq, Fish Audio, Google Vision).
Each provider is a thin wrapper around the vendor's REST API.
"""

import base64
import io
import json
import os
import time
from typing import Optional

import requests

# Persistent HTTP sessions for connection reuse (avoids TCP+TLS handshake per call)
_groq_session = requests.Session()
_fish_session = requests.Session()
_gemini_session = requests.Session()
_claude_session = requests.Session()

# ── API Keys (from environment / .env) ─────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
GOOGLE_VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY", "")

# ── Model Configuration ───────────────────────────────────────────────────

# Primary agent model (smart home, general conversation)
PRIMARY_MODEL = os.environ.get("BMO_PRIMARY_MODEL", "gemini-3.1-pro")
# Router model (intent classification, simple commands)
ROUTER_MODEL = os.environ.get("BMO_ROUTER_MODEL", "gemini-3-flash")
# D&D Dungeon Master model (narrative, roleplay)
DND_MODEL = os.environ.get("BMO_DND_MODEL", "claude-opus-4.6")

# Gemini API base URL
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
# Anthropic API base URL
ANTHROPIC_BASE = "https://api.anthropic.com/v1"
# Groq API base URL
GROQ_BASE = "https://api.groq.com/openai/v1"
# Fish Audio API base URL
FISH_AUDIO_BASE = "https://api.fish.audio/v1"

# Fish Audio voice model ID (set after creating BMO voice clone)
FISH_AUDIO_VOICE_ID = os.environ.get("FISH_AUDIO_VOICE_ID", "94b4570683534e37993fdffbd47d084b")

# ── Gemini Provider ───────────────────────────────────────────────────────


def _gemini_model_id(model: str) -> str:
    """Map friendly names to Gemini API model IDs."""
    mapping = {
        "gemini-3.1-pro": "gemini-3.1-pro-preview",
        "gemini-3-pro": "gemini-3-pro-preview",
        "gemini-3-flash": "gemini-3-flash-preview",
        "gemini-3-flash-lite": "gemini-3.1-flash-lite-preview",
        "gemini-2.5-pro": "gemini-2.5-pro",
        "gemini-2.5-flash": "gemini-2.5-flash",
    }
    return mapping.get(model, model)


def gemini_chat(messages: list[dict], model: str = "",
                temperature: float = 0.8, max_tokens: int = 2048) -> str:
    """Chat with Gemini API. Accepts OpenAI-style messages."""
    model = model or PRIMARY_MODEL
    model_id = _gemini_model_id(model)

    # Convert OpenAI-style messages to Gemini format
    system_instruction = None
    contents = []
    for msg in messages:
        role = msg["role"]
        if role == "system":
            system_instruction = msg["content"]
        else:
            gemini_role = "model" if role == "assistant" else "user"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": msg["content"]}],
            })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}],
        }

    url = f"{GEMINI_BASE}/models/{model_id}:generateContent?key={GEMINI_API_KEY}"

    # Retry on transient 500 errors (Gemini preview models can be flaky)
    last_err = None
    for attempt in range(3):
        try:
            r = _gemini_session.post(url, json=payload, timeout=120)
            r.raise_for_status()
            break
        except requests.exceptions.HTTPError as e:
            if r.status_code >= 500 and attempt < 2:
                time.sleep(1 * (attempt + 1))
                last_err = e
                continue
            raise
    else:
        raise last_err  # type: ignore[misc]

    data = r.json()
    candidates = data.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)
    return ""


# ── Anthropic (Claude) Provider ───────────────────────────────────────────


def _claude_model_id(model: str) -> str:
    """Map friendly names to Claude API model IDs."""
    mapping = {
        "claude-opus-4.6": "claude-opus-4-6",
        "claude-opus-4": "claude-opus-4-20250514",
        "claude-sonnet-4.6": "claude-sonnet-4-6",
        "claude-sonnet-4": "claude-sonnet-4-20250514",
        "claude-haiku-4.5": "claude-haiku-4-5-20241022",
    }
    return mapping.get(model, model)


def claude_chat(messages: list[dict], model: str = "",
                temperature: float = 0.8, max_tokens: int = 2048) -> str:
    """Chat with Claude API. Accepts OpenAI-style messages."""
    model = model or DND_MODEL
    model_id = _claude_model_id(model)

    system_text = None
    api_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_text = msg["content"]
        else:
            api_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

    payload = {
        "model": model_id,
        "messages": api_messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if system_text:
        payload["system"] = system_text

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    r = _claude_session.post(f"{ANTHROPIC_BASE}/messages", json=payload,
                      headers=headers, timeout=120)
    r.raise_for_status()

    data = r.json()
    content_blocks = data.get("content", [])
    return "".join(b.get("text", "") for b in content_blocks if b.get("type") == "text")


# ── Unified LLM Router ───────────────────────────────────────────────────


def cloud_chat(messages: list[dict], model: str = "",
               temperature: float = 0.8, max_tokens: int = 2048) -> str:
    """Route chat to the correct cloud provider based on model name."""
    model = model or PRIMARY_MODEL

    if model.startswith("gemini"):
        return gemini_chat(messages, model, temperature, max_tokens)
    elif model.startswith("claude"):
        return claude_chat(messages, model, temperature, max_tokens)
    else:
        # Default to Gemini primary
        return gemini_chat(messages, PRIMARY_MODEL, temperature, max_tokens)


# ── Groq STT (Whisper) ───────────────────────────────────────────────────


def groq_stt(audio_bytes: bytes, language: str = "en", prompt: str = "") -> dict:
    """Transcribe audio using Groq Whisper Large-v3 Full.

    Args:
        audio_bytes: WAV/MP3/FLAC audio data
        language: Language code (default: "en")

    Returns:
        {"text": "transcribed text", "language": "en", "duration": 5.2}
    """
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    files = {
        "file": ("audio.wav", io.BytesIO(audio_bytes), "audio/wav"),
        "model": (None, "whisper-large-v3-turbo"),
        "language": (None, language),
        "response_format": (None, "verbose_json"),
    }
    if prompt:
        files["prompt"] = (None, prompt)

    r = _groq_session.post(f"{GROQ_BASE}/audio/transcriptions",
                      headers=headers, files=files, timeout=30)
    r.raise_for_status()

    data = r.json()
    return {
        "text": data.get("text", ""),
        "language": data.get("language", language),
        "duration": data.get("duration", 0),
        "segments": data.get("segments", []),
    }


# ── Fish Audio TTS ───────────────────────────────────────────────────────


def fish_audio_tts(text: str, voice_id: str = "",
                   format: str = "wav") -> bytes:
    """Generate speech using Fish Audio API.

    Args:
        text: Text to speak
        voice_id: Fish Audio voice model ID (defaults to BMO voice)
        format: Output format ("wav", "mp3", "opus")

    Returns:
        Audio bytes
    """
    voice_id = voice_id or FISH_AUDIO_VOICE_ID

    headers = {
        "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
        "Content-Type": "application/json",
        "model": "s1",
    }

    payload = {
        "text": text,
        "reference_id": voice_id,
        "format": format,
    }

    r = _fish_session.post(f"{FISH_AUDIO_BASE}/tts", json=payload,
                      headers=headers, timeout=30)
    r.raise_for_status()

    return r.content


# ── Google Cloud Vision ──────────────────────────────────────────────────


def google_vision_detect(image_bytes: bytes,
                         features: Optional[list[str]] = None) -> dict:
    """Detect objects/labels/text in an image using Google Cloud Vision API.

    Args:
        image_bytes: JPEG/PNG image data
        features: List of detection types. Options:
            "LABEL_DETECTION", "OBJECT_LOCALIZATION", "TEXT_DETECTION",
            "FACE_DETECTION", "LANDMARK_DETECTION"

    Returns:
        Raw Vision API response with annotations
    """
    if features is None:
        features = ["LABEL_DETECTION", "OBJECT_LOCALIZATION", "TEXT_DETECTION"]

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "requests": [{
            "image": {"content": b64_image},
            "features": [{"type": f, "maxResults": 20} for f in features],
        }]
    }

    url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}"
    r = requests.post(url, json=payload, timeout=30)
    r.raise_for_status()

    data = r.json()
    responses = data.get("responses", [{}])
    return responses[0] if responses else {}


def google_vision_describe(image_bytes: bytes) -> str:
    """Get a human-readable description of an image.

    Uses label + object detection, then formats into natural language.
    """
    result = google_vision_detect(
        image_bytes,
        features=["LABEL_DETECTION", "OBJECT_LOCALIZATION"],
    )

    labels = [a["description"] for a in result.get("labelAnnotations", [])]
    objects = [a["name"] for a in result.get("localizedObjectAnnotations", [])]

    parts = []
    if objects:
        parts.append(f"Objects detected: {', '.join(objects[:10])}")
    if labels:
        parts.append(f"Scene labels: {', '.join(labels[:10])}")

    return ". ".join(parts) if parts else "No objects or labels detected."
