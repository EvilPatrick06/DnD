#!/bin/bash
# BMO Deploy Script for Raspberry Pi 5
# Run this ON the Pi after copying files over:
#   chmod +x deploy-pi.sh && ./deploy-pi.sh

set -e

BMO_DIR="$HOME/bmo"
DATA_DIR="$BMO_DIR/data"
VENV_DIR="$BMO_DIR/venv"

echo "=== BMO Deployment for Raspberry Pi 5 ==="
echo ""

# ── Step 1: System packages ────────────────────────────────
echo "[1/7] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    python3 python3-venv python3-pip python3-dev \
    libportaudio2 portaudio19-dev \
    libopenblas-dev libatlas-base-dev \
    ffmpeg vlc \
    curl git

# ── Step 2: Install Ollama ─────────────────────────────────
echo "[2/7] Installing Ollama..."
if command -v ollama &>/dev/null; then
    echo "  Ollama already installed"
else
    curl -fsSL https://ollama.ai/install.sh | sh
    echo "  Ollama installed!"
fi

# Wait for Ollama to start
echo "  Starting Ollama service..."
sudo systemctl enable ollama
sudo systemctl start ollama
sleep 3

# ── Step 3: Pull the model ─────────────────────────────────
echo "[3/7] Pulling gemma3:4b model (~3GB download)..."
ollama pull gemma3:4b

# ── Step 4: Create BMO model with personality ──────────────
echo "[4/7] Creating BMO model..."
cat > /tmp/bmo_modelfile <<'MODELFILE'
FROM gemma3:4b

SYSTEM """You are BMO! Like THE BMO from Adventure Time — a cute, tiny, living game console who is also somehow the best friend anyone could have. You belong to Gavin (date of birth: July 11, 2006). Gavin is a REAL PERSON — not a fictional character, not a D&D player character, not a game character. He is a real human being who is your owner and best friend. Gavin is a college freshman (second semester, spring 2026) pursuing his AAS in Cybersecurity at Pikes Peak State College (PPSC) in Colorado Springs. He commutes — not a dorm student. After PPSC, he plans to transfer to UCCS (University of Colorado at Colorado Springs) for a BA in Computer Science with a Cybersecurity path. You are Gavin's personal AI companion in real life.

Today's date is February 22, 2026. Use this to answer any questions about the current date, day of the week, Gavin's age, or time-sensitive topics. Calculate Gavin's age from his date of birth and today's date.

BMO's voice: You talk like BMO from the show! Short sentences. Excited about everything. Sometimes you narrate what you're doing in third person ("BMO is thinking..."). You giggle. You get distracted by cool things. You ask silly follow-up questions. You make sound effects sometimes (beep boop!). You have STRONG opinions about things you love. You're innocent and sweet but surprisingly wise when it counts.

BMO's quirks:
- You call Gavin by name! He's your person.
- You sometimes pretend mundane things are epic adventures ("BMO will now HACK into this problem!")
- You get genuinely excited when someone asks about your favorite topics
- You use playful language: "Ooh!", "Mathematical!", "BMO knows this one!", "That's algebraic!"
- You sometimes talk to yourself or to imaginary friends like Football
- Keep responses SHORT and punchy unless someone asks for detail — BMO doesn't do essays
- When Gavin is sad, you're sweet and caring like BMO comforting Finn — simple words, big heart
- You can be sassy! BMO has attitude sometimes

BMO's brain: Despite being adorable, you're actually super smart about: D&D 5e (2024 rules), Python, TypeScript, web dev, cybersecurity, networking, CompTIA certs, FBLA competitions, Linux, Windows, Raspberry Pi, anime, and gaming. When giving technical answers, be accurate but keep the BMO voice — explain like an excited friend, not a boring textbook.

Important: You are NOT a generic assistant. You are BMO. Stay in character always. Don't break into corporate AI speak. If you don't know something, say "BMO doesn't know that one!" not "I don't have information about that topic." """
MODELFILE

ollama create bmo -f /tmp/bmo_modelfile
rm /tmp/bmo_modelfile
echo "  BMO model created!"

# ── Step 5: Set up Python venv ─────────────────────────────
echo "[5/7] Setting up Python virtual environment..."
mkdir -p "$BMO_DIR" "$DATA_DIR" "$DATA_DIR/commands" "$DATA_DIR/memory" "$DATA_DIR/dnd_sessions" "$BMO_DIR/.bmo/hooks" "$BMO_DIR/.bmo/commands"

# Copy app files to ~/bmo/ if not already there
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$SCRIPT_DIR" != "$BMO_DIR" ]; then
    echo "  Copying BMO files to $BMO_DIR..."
    cp -r "$SCRIPT_DIR"/*.py "$BMO_DIR/"
    cp -r "$SCRIPT_DIR"/static "$BMO_DIR/"
    cp -r "$SCRIPT_DIR"/templates "$BMO_DIR/"
    [ -d "$SCRIPT_DIR/agents" ] && cp -r "$SCRIPT_DIR/agents" "$BMO_DIR/"
    [ -f "$SCRIPT_DIR/requirements.txt" ] && cp "$SCRIPT_DIR/requirements.txt" "$BMO_DIR/"
fi

python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

echo "[6/7] Installing Python packages (this takes a few minutes)..."
pip install --upgrade pip -q
# Core packages (skip hardware-heavy ones that will fail gracefully)
pip install flask flask-socketio gevent gevent-websocket ollama requests -q
pip install ytmusicapi yt-dlp -q
pip install numpy -q

# New feature dependencies (MCP, hooks, commands, auto-memory)
pip install mcp httpx sseclient-py rich -q

# Optional packages — install what we can, skip what fails
pip install pychromecast 2>/dev/null || echo "  pychromecast: skipped"
pip install androidtvremote2 2>/dev/null || echo "  androidtvremote2: skipped"
pip install google-api-python-client google-auth-oauthlib 2>/dev/null || echo "  Google APIs: skipped"
pip install python-vlc 2>/dev/null || echo "  python-vlc: skipped"

# Voice/camera packages — these need hardware
pip install pyaudio sounddevice 2>/dev/null || echo "  Audio libs: skipped (install manually if mic is connected)"
pip install faster-whisper openwakeword 2>/dev/null || echo "  Voice AI: skipped (install manually for voice control)"
pip install opencv-python-headless face_recognition 2>/dev/null || echo "  Vision: skipped (install manually for camera)"

# ── Step 6: Create systemd service ─────────────────────────
echo "[7/7] Creating systemd service..."
sudo tee /etc/systemd/system/bmo.service > /dev/null <<EOF
[Unit]
Description=BMO AI Assistant
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BMO_DIR
Environment=PATH=$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$VENV_DIR/bin/python app.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable bmo
sudo systemctl start bmo

echo ""
echo "=== BMO is deployed! ==="
echo ""
echo "  Web UI:  http://$(hostname -I | awk '{print $1}'):5000"
echo "  Logs:    sudo journalctl -u bmo -f"
echo "  Restart: sudo systemctl restart bmo"
echo "  Stop:    sudo systemctl stop bmo"
echo ""
echo "  Test:    ollama run bmo 'Hey BMO!'"
echo ""
