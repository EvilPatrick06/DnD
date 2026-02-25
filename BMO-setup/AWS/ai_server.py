"""GPU AI Server — Consolidated Flask API for LLM, TTS, STT, Vision, and RAG.

Runs on EC2 g5.xlarge (A10G 24GB VRAM). Serves both BMO (Pi) and VTT (Electron app).
All models are free, open-source, self-hosted.
"""

import io
import json
import logging
import os
import subprocess
import tempfile
import time
from functools import wraps
from pathlib import Path

from flask import Flask, Response, jsonify, request, stream_with_context

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────

DATA_DIR = os.environ.get("AI_DATA_DIR", "/opt/ai-server/data")
RAG_DIR = os.path.join(DATA_DIR, "rag_data")
VOICES_DIR = os.path.join(DATA_DIR, "voices")
BMO_VOICES_DIR = os.path.join(VOICES_DIR, "bmo")
NPC_VOICES_DIR = os.path.join(VOICES_DIR, "npc")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "bmo")

# Access control: VTT can only query 'dnd' domain
VTT_ALLOWED_DOMAINS = {"dnd"}

# ── Lazy Model Loading ─────────────────────────────────────────────────────

_whisper_model = None
_yolo_model = None
_fish_speech = None
_rag_engine = None


def get_whisper():
    """Load Whisper Large-v3 on first use."""
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading Whisper Large-v3...")
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("large-v3", device="cuda", compute_type="float16")
        logger.info("Whisper loaded.")
    return _whisper_model


def get_yolo():
    """Load YOLOv8-Large on first use."""
    global _yolo_model
    if _yolo_model is None:
        logger.info("Loading YOLOv8-Large...")
        from ultralytics import YOLO
        _yolo_model = YOLO("yolov8l.pt")
        logger.info("YOLO loaded.")
    return _yolo_model


def get_rag():
    """Load RAG search engine with all available indexes."""
    global _rag_engine
    if _rag_engine is None:
        from rag_search import SearchEngine
        _rag_engine = SearchEngine()

        for domain in ["dnd", "personal", "projects"]:
            index_path = os.path.join(RAG_DIR, f"chunk-index-{domain}.json")
            if os.path.exists(index_path):
                count = _rag_engine.load_index_file(domain, index_path)
                logger.info(f"RAG: loaded {count} chunks for domain '{domain}'")
            else:
                logger.info(f"RAG: no index found for domain '{domain}' at {index_path}")

    return _rag_engine


# ── Auth Middleware ─────────────────────────────────────────────────────────

API_KEY = os.environ.get("AI_SERVER_KEY", "")


def require_auth(f):
    """Require API key for all endpoints (if configured)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if API_KEY:
            auth = request.headers.get("Authorization", "")
            if auth != f"Bearer {API_KEY}":
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# ── Health ─────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check for monitoring."""
    try:
        import requests
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    return jsonify({
        "status": "ok" if ollama_ok else "degraded",
        "ollama": ollama_ok,
        "timestamp": time.time(),
    })


# ── LLM (Ollama Proxy) ────────────────────────────────────────────────────

@app.route("/llm/chat", methods=["POST"])
@require_auth
def llm_chat():
    """Proxy chat to Ollama with streaming support."""
    import requests

    data = request.json or {}
    model = data.get("model", OLLAMA_MODEL)
    messages = data.get("messages", [])
    stream = data.get("stream", True)
    options = data.get("options", {})

    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "options": options,
    }

    if stream:
        def generate():
            try:
                r = requests.post(
                    f"{OLLAMA_URL}/api/chat",
                    json=payload,
                    stream=True,
                    timeout=120,
                )
                for line in r.iter_lines():
                    if line:
                        yield line.decode("utf-8") + "\n"
            except Exception as e:
                yield json.dumps({"error": str(e)}) + "\n"

        return Response(
            stream_with_context(generate()),
            content_type="application/x-ndjson",
        )
    else:
        try:
            r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=120)
            return jsonify(r.json())
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route("/llm/generate", methods=["POST"])
@require_auth
def llm_generate():
    """Proxy generate (completion) to Ollama."""
    import requests

    data = request.json or {}
    model = data.get("model", OLLAMA_MODEL)

    payload = {
        "model": model,
        "prompt": data.get("prompt", ""),
        "stream": data.get("stream", False),
        "options": data.get("options", {}),
    }

    if data.get("system"):
        payload["system"] = data["system"]

    try:
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=120)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── TTS (Fish Speech) ─────────────────────────────────────────────────────

@app.route("/tts", methods=["POST"])
@require_auth
def tts():
    """Text-to-Speech with Fish Speech voice cloning.

    Request: { "text": "...", "speaker": "bmo_happy" | "npc_gruff_dwarf", "format": "wav" }
    Response: audio/wav binary
    """
    data = request.json or {}
    text = data.get("text", "")
    speaker = data.get("speaker", "bmo_calm")
    audio_format = data.get("format", "wav")

    if not text:
        return jsonify({"error": "No text provided"}), 400

    # Determine reference audio path
    if speaker.startswith("npc_"):
        ref_path = os.path.join(NPC_VOICES_DIR, f"{speaker[4:]}.wav")
    elif speaker.startswith("bmo_"):
        ref_path = os.path.join(BMO_VOICES_DIR, f"{speaker[4:]}.wav")
    else:
        ref_path = os.path.join(BMO_VOICES_DIR, "calm.wav")

    if not os.path.exists(ref_path):
        # Fall back to default BMO calm voice
        ref_path = os.path.join(BMO_VOICES_DIR, "calm.wav")
        if not os.path.exists(ref_path):
            return jsonify({"error": f"No reference audio found for speaker: {speaker}"}), 404

    try:
        # Use Fish Speech CLI for inference
        with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as tmp:
            tmp_path = tmp.name

        cmd = [
            "python", "-m", "fish_speech.inference",
            "--text", text,
            "--reference-audio", ref_path,
            "--output", tmp_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            logger.error(f"Fish Speech error: {result.stderr}")
            return jsonify({"error": "TTS generation failed", "details": result.stderr}), 500

        with open(tmp_path, "rb") as f:
            audio_data = f.read()

        os.unlink(tmp_path)

        return Response(
            audio_data,
            mimetype=f"audio/{audio_format}",
            headers={"Content-Disposition": f"inline; filename=tts.{audio_format}"},
        )

    except subprocess.TimeoutExpired:
        return jsonify({"error": "TTS generation timed out"}), 504
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/tts/speakers", methods=["GET"])
@require_auth
def tts_speakers():
    """List available TTS speaker profiles."""
    speakers = []

    for voice_dir, prefix in [(BMO_VOICES_DIR, "bmo_"), (NPC_VOICES_DIR, "npc_")]:
        if os.path.exists(voice_dir):
            for f in sorted(os.listdir(voice_dir)):
                if f.endswith(".wav"):
                    name = prefix + f[:-4]
                    speakers.append(name)

    return jsonify({"speakers": speakers})


# ── STT (Whisper Large-v3) ─────────────────────────────────────────────────

@app.route("/stt", methods=["POST"])
@require_auth
def stt():
    """Speech-to-Text with Whisper Large-v3.

    Request: multipart/form-data with 'audio' file (WAV/MP3/FLAC)
    Response: { "text": "...", "language": "en", "segments": [...] }
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        model = get_whisper()
        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            language="en",
            vad_filter=True,
        )

        text_parts = []
        segment_list = []
        for segment in segments:
            text_parts.append(segment.text)
            segment_list.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
            })

        os.unlink(tmp_path)

        return jsonify({
            "text": " ".join(text_parts).strip(),
            "language": info.language,
            "duration": round(info.duration, 2),
            "segments": segment_list,
        })

    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        logger.error(f"STT error: {e}")
        return jsonify({"error": str(e)}), 500


# ── Vision (YOLOv8-Large) ─────────────────────────────────────────────────

@app.route("/vision/detect", methods=["POST"])
@require_auth
def vision_detect():
    """Object detection with YOLOv8-Large.

    Request: multipart/form-data with 'image' file (JPEG/PNG)
    Response: { "detections": [{"class": "person", "confidence": 0.95, "bbox": [x1,y1,x2,y2]}] }
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_file = request.files["image"]

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        image_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        model = get_yolo()
        results = model(tmp_path, verbose=False)

        detections = []
        for result in results:
            for box in result.boxes:
                detections.append({
                    "class": result.names[int(box.cls[0])],
                    "confidence": round(float(box.conf[0]), 3),
                    "bbox": [round(float(x), 1) for x in box.xyxy[0]],
                })

        os.unlink(tmp_path)

        return jsonify({"detections": detections})

    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        logger.error(f"Vision detect error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/vision/describe", methods=["POST"])
@require_auth
def vision_describe():
    """Describe an image using LLM vision capabilities.

    Request: multipart/form-data with 'image' file + optional 'prompt' field
    Response: { "description": "..." }
    """
    import base64
    import requests

    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_file = request.files["image"]
    prompt = request.form.get("prompt", "Describe what you see in this image in detail.")

    image_data = image_file.read()
    b64_image = base64.b64encode(image_data).decode("utf-8")

    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{
                    "role": "user",
                    "content": prompt,
                    "images": [b64_image],
                }],
                "stream": False,
            },
            timeout=60,
        )

        result = r.json()
        description = result.get("message", {}).get("content", "")

        return jsonify({"description": description})

    except Exception as e:
        logger.error(f"Vision describe error: {e}")
        return jsonify({"error": str(e)}), 500


# ── RAG Search ─────────────────────────────────────────────────────────────

@app.route("/rag/search", methods=["POST"])
@require_auth
def rag_search():
    """Search RAG knowledge base.

    Request: { "query": "...", "domain": "dnd"|"personal"|"projects", "top_k": 5, "source": "vtt"|"bmo" }
    Response: { "results": [...] }

    Access control: VTT source can only query 'dnd' domain.
    """
    data = request.json or {}
    query = data.get("query", "")
    domain = data.get("domain", "dnd")
    domains = data.get("domains")  # Optional: search multiple domains
    top_k = data.get("top_k", 5)
    source = data.get("source", "bmo")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    # Access control: VTT can only search 'dnd'
    if source == "vtt":
        if domains:
            domains = [d for d in domains if d in VTT_ALLOWED_DOMAINS]
        elif domain not in VTT_ALLOWED_DOMAINS:
            return jsonify({"error": f"VTT access denied for domain: {domain}"}), 403

    engine = get_rag()

    if domains:
        results = engine.search_multi(query, domains, top_k=top_k)
    else:
        results = engine.search(query, domain, top_k=top_k)

    return jsonify({"results": results, "count": len(results)})


@app.route("/rag/add", methods=["POST"])
@require_auth
def rag_add():
    """Add content to a RAG domain.

    Request: { "domain": "personal", "content": "markdown text...", "source_name": "my note", "metadata": {} }
    """
    from rag_search import build_index_from_text, save_index

    data = request.json or {}
    domain = data.get("domain", "personal")
    content = data.get("content", "")
    source_name = data.get("source_name", "note")
    metadata = data.get("metadata")

    if not content:
        return jsonify({"error": "No content provided"}), 400

    engine = get_rag()
    new_chunks = build_index_from_text(content, source_name, domain, metadata)

    # Merge with existing chunks
    existing = engine.domains.get(domain, [])
    all_chunks = existing + new_chunks
    engine.load_domain(domain, all_chunks)

    # Save updated index
    index_path = os.path.join(RAG_DIR, f"chunk-index-{domain}.json")
    save_index(all_chunks, index_path)

    return jsonify({
        "added": len(new_chunks),
        "total": len(all_chunks),
        "domain": domain,
    })


@app.route("/rag/rebuild", methods=["POST"])
@require_auth
def rag_rebuild():
    """Rebuild a RAG domain index from source files.

    Request: { "domain": "dnd", "source_dir": "/path/to/markdown/files" }
    """
    from rag_search import build_index_from_markdown, save_index

    data = request.json or {}
    domain = data.get("domain", "dnd")
    source_dir = data.get("source_dir", "")

    if not source_dir or not os.path.isdir(source_dir):
        return jsonify({"error": f"Invalid source directory: {source_dir}"}), 400

    chunks = build_index_from_markdown(source_dir, domain.upper(), domain)

    engine = get_rag()
    engine.load_domain(domain, chunks)

    index_path = os.path.join(RAG_DIR, f"chunk-index-{domain}.json")
    save_index(chunks, index_path)

    return jsonify({
        "domain": domain,
        "chunks": len(chunks),
        "index_path": index_path,
    })


@app.route("/rag/stats", methods=["GET"])
@require_auth
def rag_stats():
    """Get RAG index statistics."""
    engine = get_rag()
    return jsonify({"domains": engine.get_chunk_count()})


# ── GPU Status ─────────────────────────────────────────────────────────────

@app.route("/gpu/status", methods=["GET"])
@require_auth
def gpu_status():
    """Get GPU utilization info."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=gpu_name,memory.used,memory.total,utilization.gpu,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        parts = result.stdout.strip().split(", ")
        return jsonify({
            "gpu_name": parts[0],
            "vram_used_mb": int(parts[1]),
            "vram_total_mb": int(parts[2]),
            "gpu_utilization": int(parts[3]),
            "temperature_c": int(parts[4]),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Spot Interruption Check ───────────────────────────────────────────────

@app.route("/spot/status", methods=["GET"])
def spot_status():
    """Check if EC2 spot interruption notice has been issued."""
    try:
        import requests
        r = requests.get(
            "http://169.254.169.254/latest/meta-data/spot/instance-action",
            timeout=2,
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"},
        )
        if r.status_code == 200:
            return jsonify({"interruption": True, "action": r.json()})
        return jsonify({"interruption": False})
    except Exception:
        return jsonify({"interruption": False})


# ── Entry Point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    os.makedirs(RAG_DIR, exist_ok=True)
    os.makedirs(BMO_VOICES_DIR, exist_ok=True)
    os.makedirs(NPC_VOICES_DIR, exist_ok=True)

    # Pre-load RAG indexes
    get_rag()

    logger.info("Starting AI Server on port 8000...")
    app.run(host="0.0.0.0", port=8000, threaded=True)
