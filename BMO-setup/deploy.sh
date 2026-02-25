#!/bin/bash
# deploy.sh — Deploy BMO files from Windows to Raspberry Pi
# Usage: bash deploy.sh <pi-ip> [username]
# Example: bash deploy.sh 192.168.1.100 gavin

set -e

PI_IP="${1:?Usage: bash deploy.sh <pi-ip> [username]}"
PI_USER="${2:-patrick}"
PI_DEST="${PI_USER}@${PI_IP}"

echo "=== Deploying BMO to ${PI_DEST} ==="

# Create directories on Pi
echo "Creating directories..."
ssh "${PI_DEST}" "mkdir -p ~/bmo/{config,models/piper,data/{commands,memory,dnd_sessions},templates,static/{css,js,img},.bmo/{hooks,commands},.audiocache,static/thumbcache}"

# ── Copy all 22 Python application files ──────────────────────────────
echo "Copying Python services (22 files)..."
scp pi/app.py pi/agent.py pi/cli.py pi/dev_tools.py \
    pi/voice_pipeline.py pi/voice_personality.py \
    pi/camera_service.py pi/calendar_service.py \
    pi/music_service.py pi/smart_home.py \
    pi/weather_service.py pi/timer_service.py \
    pi/tv_controller.py pi/oled_face.py \
    pi/led_controller.py pi/sound_effects.py \
    pi/dnd_engine.py pi/campaign_memory.py \
    pi/monitoring.py pi/discord_bot.py \
    pi/cloud_backup.py pi/test_server.py \
    "${PI_DEST}:~/bmo/"

scp pi/requirements.txt "${PI_DEST}:~/bmo/"

# ── Copy agents directory (33 files) ──────────────────────────────────
echo "Copying agents directory..."
scp -r pi/agents/ "${PI_DEST}:~/bmo/agents/"

# ── Copy templates and static assets ──────────────────────────────────
echo "Copying templates..."
scp pi/templates/index.html "${PI_DEST}:~/bmo/templates/"

echo "Copying static assets..."
scp pi/static/css/bmo.css "${PI_DEST}:~/bmo/static/css/"
scp pi/static/js/*.js "${PI_DEST}:~/bmo/static/js/"
scp pi/static/img/*.png "${PI_DEST}:~/bmo/static/img/" 2>/dev/null || echo "  (no images found)"

# ── Copy TV certs ─────────────────────────────────────────────────────
echo "Copying TV certs..."
scp pi/tv_cert.pem pi/tv_key.pem "${PI_DEST}:~/bmo/" 2>/dev/null || echo "  (no TV certs found — pair via the TV tab after deploy)"

# ── Copy config files ─────────────────────────────────────────────────
echo "Copying config..."
scp config/credentials.json "${PI_DEST}:~/bmo/config/" 2>/dev/null || echo "  (no credentials.json found — run authorize_calendar.py first)"
scp config/token.json "${PI_DEST}:~/bmo/config/" 2>/dev/null || echo "  (no token.json found — run authorize_calendar.py first)"

# ── Copy Modelfile ────────────────────────────────────────────────────
echo "Copying Modelfile..."
MODELFILE_PATH="AWS/Modelfile"
if [ -f "$MODELFILE_PATH" ]; then
  scp "$MODELFILE_PATH" "${PI_DEST}:~/bmo/Modelfile"
  echo "  Modelfile copied. Run on Pi: ollama create bmo -f ~/bmo/Modelfile"
else
  echo "  Modelfile not found at ${MODELFILE_PATH}"
fi

echo ""
echo "=== Deploy complete! ==="
echo ""
echo "Files deployed:"
echo "  - 22 Python services"
echo "  - agents/ directory (33 modules)"
echo "  - Templates + static assets"
echo "  - Config files"
echo ""
echo "On the Pi, run:"
echo "  1. source ~/bmo/venv/bin/activate"
echo "  2. pip install -r ~/bmo/requirements.txt"
echo "  3. pip install mcp httpx sseclient-py rich  # new feature deps"
echo "  4. ollama create bmo -f ~/bmo/Modelfile"
echo "  5. sudo systemctl restart bmo"
echo ""
echo "New feature directories created:"
echo "  ~/bmo/data/commands/   — custom slash command data"
echo "  ~/bmo/data/memory/     — auto-memory storage"
echo "  ~/bmo/data/dnd_sessions/ — D&D session persistence"
echo "  ~/bmo/.bmo/hooks/      — hook scripts"
echo "  ~/bmo/.bmo/commands/   — custom slash commands"
