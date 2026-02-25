# BMO System Architecture

## Overview

BMO is a two-system AI assistant built around a Raspberry Pi 5 physical device and a cloud GPU server. The Pi runs the user-facing application (Flask + touchscreen kiosk UI) with voice, vision, smart home, and D&D Dungeon Master capabilities. Heavy AI workloads (LLM inference, speech-to-text, text-to-speech, object detection) are offloaded to an EC2 GPU instance via HTTPS API calls. When the GPU server is unavailable (spot interruption, network outage), every service falls back to lighter local models running directly on the Pi.

Cloudflare provides the networking glue: a Tunnel exposes the Pi's services to the internet without port forwarding, R2 stores shared game assets, and Calls TURN relays WebRTC traffic for the D&D VTT app.

---

## Architecture Diagram

```
                         INTERNET
                            |
              +-------------+-------------+
              |                           |
     +--------+--------+       +---------+---------+
     |   Cloudflare    |       |   Cloudflare R2   |
     |                 |       |   (Object Store)  |
     |  Tunnel (Pi)    |       |   - Map images    |
     |  DNS records:   |       |   - Game data     |
     |   bmo.*         |       |   - Voice refs    |
     |   ai.*          |       +-------------------+
     |   signaling.*   |
     |                 |       +---------+---------+
     |  Calls TURN     |       |  Cloudflare Calls |
     |  (WebRTC relay) |       |  TURN server for  |
     +--------+--------+       |  VTT P2P WebRTC   |
              |                +-------------------+
              |
    +---------+---------+
    |     Pi Network     |
    |   (Nginx :80)     |
    |                   |
    |  / -> Flask :5000 |
    |  /peerjs -> :9000 |
    +---------+---------+
              |
   +----------+----------+
   |                      |
   v                      v
+--+------------------+  +--+------------------+
|  RASPBERRY PI 5     |  |  EC2 g5.xlarge      |
|  (8GB RAM, ARM64)   |  |  (A10G 24GB VRAM)   |
|                     |  |                     |
|  BMO Flask App :5000|  |  AI Server :8000    |
|   - Agent (LLM)    |  |   - /llm/chat       |
|   - Voice Pipeline  |  |   - /llm/generate   |
|   - Camera Service  |  |   - /tts            |
|   - Music Service   |  |   - /stt            |
|   - Smart Home      |  |   - /vision/detect  |
|   - Calendar        |  |   - /vision/describe|
|   - Weather         |  |   - /rag/search     |
|   - Timer           |  |   - /health         |
|   - TV Remote       |  |   - /gpu/status     |
|   - Notes           |  |   - /spot/status    |
|   - D&D DM Mode     |  |                     |
|                     |  |  Ollama :11434      |
|  PeerJS Server :9000|  |   - bmo (Llama 3.1  |
|  Ollama (fallback)  |  |     70B Q4_K_M)     |
|   - bmo (Gemma3:4b) |  |   - qwen2.5:32b    |
|                     |  |                     |
|  Chromium Kiosk     |  |  Fish Speech (TTS)  |
|  OLED Face Display  |  |  Whisper Large-v3   |
|  RGB LED Controller |  |  YOLOv8-Large       |
|  Pi Camera Module 3 |  |  RAG Search Engine  |
|  Microphone + Spkr  |  |                     |
|  NVMe SSD (PCIe)    |  |  Nginx + TLS :443   |
|  Freenove Case Kit  |  |  Gunicorn (2w/4t)   |
|                     |  |  Spot Monitor       |
|  cloudflared tunnel |  |                     |
+---------------------+  +---------------------+
         |                          |
         |    HTTPS API calls       |
         +--- ai.yourdomain.com ---+

   +---------------------+
   |  VTT App (Electron) |    +------------------+
   |  Windows Desktop    |    |  Players         |
   |                     +--->|  (Web browsers)  |
   |  - D&D character    |    |  Join via PeerJS |
   |    builder/sheet    |    |  WebRTC P2P      |
   |  - Map canvas (Pixi)|    +------------------+
   |  - 3D dice (Three)  |
   |  - AI DM (Ollama or |
   |    GPU server)      |
   |  - PeerJS P2P       |
   +---------------------+
```

---

## Deployment Map

| Component | Location | Port | Technology | Purpose |
|-----------|----------|------|------------|---------|
| BMO Flask App | Pi | 5000 | Flask + Flask-SocketIO + gevent | Main app server, REST API, WebSocket |
| PeerJS Signaling | Pi | 9000 | Node.js peer server | WebRTC signaling for VTT P2P |
| Nginx Reverse Proxy | Pi | 80 | Nginx | Routes `/` to Flask, `/peerjs` to PeerJS |
| Cloudflare Tunnel | Pi | -- | cloudflared | Exposes Pi services to internet |
| Ollama (fallback) | Pi | 11434 | Ollama | Local LLM: Gemma3:4b (8K ctx, 1024 tokens) |
| OLED Stats Display | Pi | -- | Python + luma.oled | System stats on 128x64 OLED |
| Chromium Kiosk | Pi | -- | Chromium | Fullscreen touchscreen UI |
| AI Server | EC2 | 8000 | Flask + Gunicorn (2 workers, 4 threads) | LLM, TTS, STT, Vision, RAG endpoints |
| Ollama (primary) | EC2 | 11434 | Ollama | Primary LLM: Llama 3.1 70B Q4 (32K ctx) |
| Fish Speech | EC2 | -- | Python module | Voice-cloned TTS (BMO + NPC voices) |
| Whisper Large-v3 | EC2 | -- | faster-whisper (CUDA fp16) | High-accuracy speech transcription |
| YOLOv8-Large | EC2 | -- | ultralytics (CUDA) | Object detection |
| RAG Search Engine | EC2 | -- | TF-IDF Python | Multi-domain knowledge search (dnd, personal, projects) |
| Nginx + TLS | EC2 | 443 | Nginx + Certbot | HTTPS termination for AI server |
| Spot Monitor | EC2 | -- | Bash systemd service | Polls EC2 metadata for spot interruption |
| Cloudflare R2 | Cloud | -- | S3-compatible storage | Map images, game data CDN |
| Cloudflare Calls | Cloud | -- | TURN server | WebRTC relay for VTT players behind NAT |

---

## AI Routing Flow

Every AI-dependent call on the Pi follows the same pattern: try GPU server first, fall back to local.

```
Request arrives at Pi service
         |
         v
  +------+------+
  | Check GPU   |  Cached health check (30s TTL)
  | /health     |  GET https://ai.yourdomain.com/health
  +------+------+
         |
    +----+----+
    |         |
  (OK)     (FAIL/TIMEOUT 3s)
    |         |
    v         v
+---+---+ +---+-------+
| GPU   | | Local     |
| Server| | Fallback  |
+---+---+ +---+-------+
    |         |
    v         v
 Response  Response
```

### LLM Calls

| Route | Model | Context Window | Max Tokens | Latency |
|-------|-------|---------------|------------|---------|
| GPU (primary) | Llama 3.1 70B Q4_K_M | 32,768 | 2,048 | ~3-5s |
| Local fallback | Gemma3:4b | 8,192 (Pi) / 32,768 (desktop) | 1,024 (Pi) / 2,048 (desktop) | ~8-15s on Pi |

The agent module (`agent.py`) routes via `_check_gpu_available()` which caches the result for 30 seconds. On failure mid-request, it catches the exception and retries with local Ollama.

### Speech-to-Text

| Route | Model | Quality |
|-------|-------|---------|
| GPU | Whisper Large-v3 (CUDA fp16) | Best accuracy, beam_size=5, VAD filter |
| Local fallback | Whisper base (CPU int8) | Lower accuracy, faster on ARM |

### Text-to-Speech

| Route | Model | Quality |
|-------|-------|---------|
| GPU | Fish Speech (voice-cloned) | Authentic BMO voice, multiple speaker profiles |
| Local fallback | Piper TTS + sox pitch shift (+400 cents) | Generic female voice pitched up |

### Object Detection

| Route | Model | Quality |
|-------|-------|---------|
| GPU | YOLOv8-Large (CUDA) | High accuracy, 80 classes |
| Local fallback | YOLOv8-Nano (CPU) | Lower accuracy, faster on ARM |

### Vision Description

Three-tier fallback:
1. GPU server LLM vision (`/vision/describe`) -- best quality
2. Local Ollama with vision model -- moderate quality
3. Object detection + face recognition text summary -- basic

---

## Data Flow: Voice Pipeline

```
         Microphone
             |
             v
   +---------+---------+
   | Wake Word Detection|  (always local -- openwakeword ONNX)
   | "hey_jarvis"       |  80ms chunks, score > 0.5 triggers
   +---------+---------+
             |
             v
   +---------+---------+
   | Record Until       |  16kHz, mono, int16
   | Silence (1.5s)     |  RMS threshold: 500, max 30s
   +---------+---------+
             |
             v
   +---------+---------+
   | Speaker ID         |  resemblyzer VoiceEncoder
   | (cosine similarity |  threshold > 0.75
   |  vs enrolled)      |
   +---------+---------+
             |
             v
   +---------+---------+
   | STT: Transcribe    |  GPU: Whisper Large-v3
   | audio -> text      |  Local: Whisper base
   +---------+---------+
             |
             v
   +---------+---------+
   | Agent: Process     |  GPU: Llama 3.1 70B
   | text, run tools    |  Local: Gemma3:4b
   +---------+---------+
             |
             v
   +---------+---------+
   | TTS: Speak         |  GPU: Fish Speech (cloned voice)
   | response           |  Local: Piper + sox pitch
   +---------+---------+
             |
             v
          Speakers
        (aplay WAV)
```

---

## Data Flow: Vision Pipeline

```
   Pi Camera Module 3
   (1280x960 main, 640x480 lores)
             |
             v
   +---------+---------+
   | Capture Frame      |  picamera2, BGR numpy array
   +---------+---------+
             |
      +------+------+
      |      |      |
      v      v      v
   MJPEG  Object  Scene
   Stream  Detect  Describe
   (10fps) (YOLO)  (LLM)
      |      |      |
      v      v      v
   Browser  JSON    Text
             |
      +------+------+
      |             |
   GPU route    Local route
   YOLOv8-L    YOLOv8-Nano
```

Additional vision capabilities:
- **Face recognition**: face_recognition library, HOG model, enrolled faces stored as pickle embeddings
- **OCR**: EasyOCR (English, CPU mode)
- **Motion detection**: Background subtraction with contour analysis, 10s cooldown between alerts

---

## Data Flow: D&D DM Mode

```
   Player speaks / types
             |
             v
   +---------+---------+
   | Agent detects D&D  |  Keywords: "be the DM", "start a campaign",
   | context            |  "let's play D&D", "roll initiative"
   +---------+---------+
             |
             v
   +---------+---------+
   | Load D&D context   |  Character JSON files
   | from VTT data dir  |  Map selection
   +---------+---------+
             |
             v
   +---------+---------+
   | LLM with DM system |  Response tags parsed:
   | prompt + RAG       |  [FACE:combat] [LED:red] [SOUND:sword]
   | knowledge base     |  [MUSIC:combat] [NPC:gruff_dwarf]
   +---------+---------+  [ROLL:2d6+5] [CONDITION:stunned]
             |
             v
   +---------+---------+
   | Save to DnD        |  ~/bmo/data/dnd_sessions/session_YYYY-MM-DD.json
   | session log         |  Game state saved on chat clear
   +---------+---------+
             |
             v
   +---------+---------+
   | TTS with NPC voice  |  Fish Speech speaker profiles:
   | or BMO voice        |  bmo_happy, bmo_dramatic, npc_gruff_dwarf, etc.
   +---------+---------+
```

---

## Data Flow: VTT Integration

```
   VTT Electron App (Windows)
             |
             +--- LLM calls --> GPU Server /llm/chat
             |                  (or local Ollama in VTT)
             |
             +--- RAG search -> GPU Server /rag/search
             |                  (domain: "dnd" only, access controlled)
             |
             +--- Ollama proxy -> GPU Server /api/ (Nginx proxies to Ollama :11434)
             |
             +--- WebRTC -----> Cloudflare Calls TURN
             |                  (fallback for NAT traversal)
             |
             +--- PeerJS -----> Pi :9000 /peerjs
                  signaling     (via Cloudflare Tunnel at signaling.*)
```

---

## Budget Breakdown (~$300/month)

| Service | Cost | Notes |
|---------|------|-------|
| **EC2 g5.xlarge spot** | ~$180/mo | A10G 24GB, 4 vCPU, 16GB RAM. Spot price ~$0.25/hr. Runs ~24hrs/day with spot interruptions. On-demand fallback: $1.006/hr |
| **EBS gp3 100GB** | ~$8/mo | Persistent storage for models, data, app. Survives spot termination |
| **Cloudflare Free Tier** | $0 | Tunnel, DNS, basic R2 (10GB free), 100k TURN minutes/mo free |
| **Cloudflare R2** | ~$2/mo | If exceeding free tier (10GB storage, 1M class A ops, 10M class B ops) |
| **Raspberry Pi 5 8GB** | ~$80 one-time | Plus Freenove case kit, camera, NVMe, touchscreen |
| **Pi electricity** | ~$3/mo | ~5W average |
| **Internet** | Existing | Home internet, no additional cost |
| **Domain** | ~$10/yr | yourdomain.com |
| **Total recurring** | **~$195/mo** | |
| **Total with buffer** | **~$250-300/mo** | Includes spot price spikes and on-demand fallback hours |

### Cost Optimization Notes

- **Spot instances** save 60-75% vs on-demand. The spot monitor service handles graceful shutdown on 2-minute interruption notice.
- **EBS volume** persists across spot terminations. User data script reattaches on new instance boot.
- **Lazy model loading** on GPU server means VRAM is only consumed when features are used. Whisper, YOLO, and RAG indexes load on first request.
- **Health check caching** (30s TTL) avoids hammering the GPU server with connectivity checks.
- **Local fallback** means the system is usable even when the GPU server is completely down, just with lower quality.

---

## Systemd Services

### Raspberry Pi

| Service | Unit File | Description |
|---------|-----------|-------------|
| `bmo.service` | `/etc/systemd/system/bmo.service` | BMO Flask app (main application) |
| `peerjs.service` | `/etc/systemd/system/peerjs.service` | PeerJS signaling server |
| `cloudflared.service` | `/etc/systemd/system/cloudflared.service` | Cloudflare Tunnel |
| `oled-stats.service` | `/etc/systemd/system/oled-stats.service` | OLED display system stats |
| `ollama.service` | (installed by Ollama) | Local LLM fallback |
| `nginx.service` | (system) | Reverse proxy |

### EC2 GPU Server

| Service | Unit File | Description |
|---------|-----------|-------------|
| `ai-server.service` | `/etc/systemd/system/ai-server.service` | Flask AI server via Gunicorn |
| `spot-monitor.service` | `/etc/systemd/system/spot-monitor.service` | EC2 spot interruption handler |
| `ollama.service` | (installed by Ollama) | Primary LLM server |
| `nginx.service` | (system) | TLS termination + reverse proxy |

---

## Security

- **API key auth**: All GPU server endpoints require `Authorization: Bearer <key>` header (configurable via `AI_SERVER_KEY` env var).
- **Domain access control**: VTT source can only query the `dnd` RAG domain. BMO can query all domains (dnd, personal, projects).
- **TLS everywhere**: EC2 uses Let's Encrypt via Certbot + Nginx. Pi traffic goes through Cloudflare Tunnel (TLS by default).
- **No open ports on Pi**: Cloudflare Tunnel means no port forwarding needed on home router.
- **File path whitelist**: The Pi agent has explicit read access to specific directories only.
