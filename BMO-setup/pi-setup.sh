#!/bin/bash
# bmo-setup.sh
# One-time setup script for Pi 5 AI Voice + Vision Assistant (BMO)
# Run as: chmod +x bmo-setup.sh && ./bmo-setup.sh
#
# Prerequisites:
#   - Raspberry Pi 5 8GB with Freenove Computer Case Kit
#   - Internet connection (WiFi or Ethernet)
#   - Running as the default user (not root)
#   - Display FPC cable: contacts facing the PCB on both ends
#   - Display in CAM/DISP 1 (closest to HDMI ports)
#   - Camera in CAM/DISP 0 (closest to USB-C power)

set -e  # Exit on error

CURRENT_USER=$(whoami)

echo "============================================"
echo "  BMO Setup — Pi 5 AI Voice + Vision Assistant"
echo "  User: ${CURRENT_USER}"
echo "============================================"
echo ""

# ── Phase 1: System Update ──────────────────────────────────────────

echo "=== Phase 1: System Update ==="
sudo apt update && sudo apt full-upgrade -y

echo "=== Phase 1: Set timezone ==="
sudo timedatectl set-timezone America/Denver

echo "=== Phase 1: Enable Hardware Interfaces ==="
sudo raspi-config nonint do_camera 0      # Enable camera
sudo raspi-config nonint do_i2c 0         # Enable I2C (OLED, expansion board)
sudo raspi-config nonint do_spi 0         # Enable SPI

echo "=== Phase 1: Configure audio output ==="
sudo raspi-config nonint do_audio 1       # 1 = headphone jack (change to 0 for HDMI)

echo "=== Phase 1: Install System Dependencies ==="
sudo apt install -y \
  python3-pip python3-venv python3-picamera2 \
  python3-dev libatlas-base-dev libffi-dev libssl-dev \
  portaudio19-dev libopus-dev ffmpeg \
  cmake libopenblas-dev liblapack-dev \
  vlc sox alsa-utils \
  git curl wget \
  chromium-browser unclutter \
  nginx

echo "=== Phase 1: Install Freenove Hardware Packages ==="
sudo apt install -y \
  python3-smbus python3-pil python3-gpiozero python3-rpi-lgpio \
  python3-luma.oled python3-luma.core \
  python3-picamera2 python3-libcamera \
  i2c-tools nvme-cli wireless-tools net-tools raspi-config

# ── Phase 1b: PCIe / NVMe Config ─────────────────────────────────────

echo "=== Phase 1b: Configure PCIe for NVMe SSD ==="

# Enable external PCIe in config.txt
CONFIG=/boot/firmware/config.txt
if ! grep -q "^dtparam=pciex1$" "$CONFIG"; then
  # Add under [all] section, create it if needed
  if grep -q "^\[all\]" "$CONFIG"; then
    sudo sed -i '/^\[all\]/a dtparam=pciex1' "$CONFIG"
  else
    echo -e "\n[all]\ndtparam=pciex1" | sudo tee -a "$CONFIG" > /dev/null
  fi
  echo "  Added dtparam=pciex1"
fi

if ! grep -q "^dtparam=pciex1_gen=3$" "$CONFIG"; then
  sudo sed -i '/^dtparam=pciex1$/a dtparam=pciex1_gen=3' "$CONFIG"
  echo "  Added dtparam=pciex1_gen=3"
fi

if ! grep -q "pciex1-compat-pi5" "$CONFIG"; then
  sudo sed -i '/^dtparam=pciex1_gen=3$/a dtoverlay=pciex1-compat-pi5,no-l0s' "$CONFIG"
  echo "  Added pciex1-compat-pi5 overlay"
fi

# Add PCIE_PROBE=1 to EEPROM for non-HAT+ M.2 adapters
EEPROM_CFG=$(sudo rpi-eeprom-config)
if ! echo "$EEPROM_CFG" | grep -q "PCIE_PROBE=1"; then
  echo "  Adding PCIE_PROBE=1 to EEPROM..."
  sudo rpi-eeprom-config > /tmp/eeprom.conf
  echo "PCIE_PROBE=1" >> /tmp/eeprom.conf
  sudo rpi-eeprom-config -a /tmp/eeprom.conf
  rm -f /tmp/eeprom.conf
  echo "  EEPROM updated with PCIE_PROBE=1"
fi

# ── Phase 2: Ollama ─────────────────────────────────────────────────

echo "=== Phase 2: Install Ollama ==="
curl -fsSL https://ollama.com/install.sh | sh

echo "=== Phase 2: Start Ollama service ==="
sudo systemctl enable ollama
sudo systemctl start ollama

echo "=== Phase 2: Pull base model ==="
ollama pull llama3.2:3b

# NOTE: Ollama on Pi is for offline fallback only.
# Main AI (Claude API) runs on the GPU server. Ollama provides local
# inference when the network or GPU server is unavailable.

# ── Phase 3: Python Environment ─────────────────────────────────────

echo "=== Phase 3: Create Python virtual environment ==="
mkdir -p ~/bmo/{config,models/piper,data/{commands,memory,dnd_sessions},.audiocache,static/thumbcache,.bmo/{hooks,commands}}
python3 -m venv ~/bmo/venv
source ~/bmo/venv/bin/activate

echo "=== Phase 3: Install Python packages ==="
pip install --upgrade pip

# Core AI/ML
pip install \
  faster-whisper \
  openwakeword \
  resemblyzer \
  ollama

# TTS
pip install piper-tts

# Vision / Face / Object Detection
pip install \
  face_recognition \
  opencv-python-headless \
  ultralytics \
  easyocr

# Audio
pip install \
  pyaudio \
  sounddevice \
  numpy

# Web framework
pip install \
  flask \
  flask-socketio \
  gevent gevent-websocket

# Google APIs
pip install \
  google-api-python-client \
  google-auth-oauthlib

# Smart home / Chromecast
pip install pychromecast

# Music
pip install \
  ytmusicapi \
  yt-dlp \
  python-vlc

# TV Remote
pip install androidtvremote2

# SSH / Search
pip install \
  paramiko \
  duckduckgo-search

# Misc
pip install requests

# New features (MCP, hooks, custom commands, auto-memory, context compression)
pip install \
  mcp \
  httpx \
  sseclient-py \
  rich

echo "=== Phase 3: Download Whisper model (base, ~150MB) ==="
python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

echo "=== Phase 3: Download Piper TTS voice (BMO base voice) ==="
cd ~/bmo/models/piper
wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx
wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json
cd ~

echo "=== Phase 3: Download openWakeWord models ==="
python3 -c "import openwakeword; openwakeword.utils.download_models()"

echo "=== Phase 3: Download YOLOv8 Nano model ==="
python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Run manually for YT Music personal account:
# source ~/bmo/venv/bin/activate && ytmusicapi oauth

# ── Phase 4: Freenove Hardware ────────────────────────────────────────

echo "=== Phase 4: Clone Freenove repos ==="
cd ~
if [ ! -d "Freenove_Computer_Case_Kit_for_Raspberry_Pi" ]; then
  git clone https://github.com/Freenove/Freenove_Computer_Case_Kit_for_Raspberry_Pi.git
fi
if [ ! -d "Freenove_Touchscreen_Monitor_for_Raspberry_Pi" ]; then
  git clone https://github.com/Freenove/Freenove_Touchscreen_Monitor_for_Raspberry_Pi.git
fi
cd ~

echo "=== Phase 4: Configure expansion board (LEDs + fans) ==="
python3 << 'PYEOF'
import sys
sys.path.insert(0, "/home/${CURRENT_USER}/Freenove_Computer_Case_Kit_for_Raspberry_Pi/Code")
from expansion import Expansion
import time

board = Expansion()
try:
    board.set_led_mode(4)          # Rainbow mode
    board.set_fan_mode(2)          # Auto fan mode
    board.set_fan_threshold(35, 50)  # Fans ramp 35-50C
    board.set_save_flash(1)        # Persist across reboots
    time.sleep(0.5)
    print(f"  Brand: {board.get_brand()}")
    print(f"  Version: {board.get_version()}")
    print(f"  Temp: {board.get_temp()}C")
    print(f"  LEDs: Rainbow mode")
    print(f"  Fans: Auto mode (35-50C)")
    print(f"  Saved to flash")
except Exception as e:
    print(f"  Expansion board error: {e}")
    print(f"  (Will work after reboot with I2C enabled)")
finally:
    board.end()
PYEOF

echo "=== Phase 4: Create OLED system stats script ==="
# NOTE: oled-stats.py will be replaced by oled_face.py in Phase 2
# (animated BMO face with expressions instead of raw system stats)
cat > ~/oled-stats.py << 'OLEDEOF'
import time
import subprocess
import os
import sys
sys.path.insert(0, os.path.expanduser("~/Freenove_Computer_Case_Kit_for_Raspberry_Pi/Code"))
from oled import OLED

def get_cpu_temp():
    with open("/sys/class/thermal/thermal_zone0/temp") as f:
        return float(f.read().strip()) / 1000

def get_cpu_usage():
    output = subprocess.check_output(["vmstat", "1", "2"], text=True)
    lines = output.strip().split("\n")
    idle = int(lines[-1].split()[-3])
    return 100 - idle

def get_mem_info():
    with open("/proc/meminfo") as f:
        lines = f.readlines()
    total = int(lines[0].split()[1]) // 1024
    available = int(lines[2].split()[1]) // 1024
    used = total - available
    return used, total

def get_disk_usage():
    st = os.statvfs("/")
    total = st.f_blocks * st.f_frsize // (1024**3)
    used = (st.f_blocks - st.f_bfree) * st.f_frsize // (1024**3)
    return used, total

def get_ip():
    try:
        output = subprocess.check_output(["hostname", "-I"], text=True).strip()
        return output.split()[0] if output else "No IP"
    except:
        return "No IP"

def get_uptime():
    with open("/proc/uptime") as f:
        secs = int(float(f.read().split()[0]))
    hrs = secs // 3600
    mins = (secs % 3600) // 60
    return f"{hrs}h {mins}m"

oled = OLED()
try:
    while True:
        oled.clear()
        ip = get_ip()
        cpu = get_cpu_usage()
        temp = get_cpu_temp()
        mem_used, mem_total = get_mem_info()
        disk_used, disk_total = get_disk_usage()
        uptime = get_uptime()
        oled.draw_text(f"{ip}", position=(0, 0), font_size=11)
        oled.draw_text(f"CPU: {cpu}%  {temp:.0f}C", position=(0, 14), font_size=11)
        oled.draw_text(f"RAM: {mem_used}/{mem_total}MB", position=(0, 28), font_size=11)
        oled.draw_text(f"DSK: {disk_used}/{disk_total}GB  {uptime}", position=(0, 42), font_size=11)
        oled.show()
        time.sleep(3)
except KeyboardInterrupt:
    pass
finally:
    oled.clear()
    oled.show()
    oled.close()
OLEDEOF

echo "=== Phase 4: Create OLED stats systemd service ==="
sudo tee /etc/systemd/system/oled-stats.service > /dev/null << 'UNIT'
[Unit]
Description=OLED System Stats Display
After=multi-user.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /home/REPLACE_USER/oled-stats.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
sudo sed -i "s/REPLACE_USER/${CURRENT_USER}/g" /etc/systemd/system/oled-stats.service
sudo systemctl daemon-reload
sudo systemctl enable oled-stats.service
sudo systemctl start oled-stats.service

# ── Phase 5: BMO Systemd Service ─────────────────────────────────────

echo "=== Phase 5: Create BMO systemd service ==="
sudo tee /etc/systemd/system/bmo.service > /dev/null << 'UNIT'
[Unit]
Description=BMO AI Voice + Vision Assistant
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=REPLACE_USER
WorkingDirectory=/home/REPLACE_USER/bmo
Environment="PATH=/home/REPLACE_USER/bmo/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/REPLACE_USER/bmo/venv/bin/python app.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
sudo sed -i "s/REPLACE_USER/${CURRENT_USER}/g" /etc/systemd/system/bmo.service
sudo systemctl daemon-reload
sudo systemctl enable bmo.service

# ── Phase 5b: PeerJS Signaling Server ────────────────────────────────

echo "=== Phase 5b: Install Node.js (v20 LTS) ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

echo "=== Phase 5b: Verify npx (needed for MCP stdio servers) ==="
npx --version || { echo "npx not found — check Node.js installation"; exit 1; }

echo "=== Phase 5b: Install PeerJS Server ==="
sudo npm install -g peer

echo "=== Phase 5b: Create PeerJS systemd service ==="
sudo tee /etc/systemd/system/peerjs.service > /dev/null << 'UNIT'
[Unit]
Description=PeerJS Signaling Server
After=network.target

[Service]
Type=simple
User=REPLACE_USER
ExecStart=/usr/bin/peerjs --port 9000 --path /peerjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
sudo sed -i "s/REPLACE_USER/${CURRENT_USER}/g" /etc/systemd/system/peerjs.service
sudo systemctl daemon-reload
sudo systemctl enable peerjs.service
sudo systemctl start peerjs.service

# ── Phase 5c: Cloudflare Tunnel ──────────────────────────────────────

echo "=== Phase 5c: Install cloudflared ==="
curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i /tmp/cloudflared.deb
rm -f /tmp/cloudflared.deb

echo "=== Phase 5c: Create Cloudflare Tunnel systemd service ==="
sudo tee /etc/systemd/system/cloudflared.service > /dev/null << 'UNIT'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=REPLACE_USER
ExecStart=/usr/bin/cloudflared tunnel run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
sudo sed -i "s/REPLACE_USER/${CURRENT_USER}/g" /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable cloudflared.service
# NOTE: cloudflared tunnel must be configured before starting:
#   cloudflared tunnel login
#   cloudflared tunnel create bmo
#   Then start: sudo systemctl start cloudflared.service

# ── Phase 5d: Nginx Reverse Proxy ────────────────────────────────────

echo "=== Phase 5d: Configure Nginx reverse proxy ==="
sudo tee /etc/nginx/sites-available/bmo > /dev/null << 'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # BMO Flask app
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (Flask-SocketIO)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # PeerJS signaling server
    location /peerjs {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (PeerJS)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/bmo /etc/nginx/sites-enabled/bmo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx

# ── Phase 5e: GitHub CLI ─────────────────────────────────────────────

echo "=== Phase 5e: Install GitHub CLI (gh) ==="
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=arm64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt-get update && sudo apt-get install -y gh

# ── Phase 6: Kiosk Mode Autostart ────────────────────────────────────

echo "=== Phase 6: Configure Chromium kiosk autostart ==="
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/bmo-ui.desktop << 'DESKTOP'
[Desktop Entry]
Type=Application
Name=BMO Assistant UI
Comment=BMO touchscreen kiosk interface
Exec=bash -c 'while ! curl -s http://localhost:5000 > /dev/null 2>&1; do sleep 1; done; chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 --disable-translate --disable-pinch --overscroll-history-navigation=0 --touch-events=enabled --disable-features=TranslateUI http://localhost:5000'
X-GNOME-Autostart-enabled=true
DESKTOP

echo "=== Phase 6: Configure cursor hiding ==="
cat > ~/.config/autostart/hide-cursor.desktop << 'DESKTOP'
[Desktop Entry]
Type=Application
Name=Hide Cursor
Exec=unclutter -idle 0.5 -root
DESKTOP

echo "=== Phase 6: Disable screen blanking/DPMS ==="
sudo raspi-config nonint do_blanking 0
sudo mkdir -p /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/01-no-blanking.conf > /dev/null << 'EOF'
[Seat:*]
xserver-command=X -s 0 -dpms
EOF

# ── Done ─────────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Hardware configured:"
echo "  - PCIe/NVMe: enabled (dtparam=pciex1, Gen3, PCIE_PROBE=1)"
echo "  - I2C, SPI, Camera: enabled"
echo "  - DSI Touchscreen: auto-detect (no overlay needed)"
echo "  - OLED stats: running as systemd service"
echo "  - Expansion board: rainbow LEDs, auto fans (35-50C)"
echo "  - Audio: headphone jack"
echo ""
echo "Services configured:"
echo "  - BMO Flask app (bmo.service → port 5000)"
echo "  - PeerJS signaling (peerjs.service → port 9000)"
echo "  - Cloudflare Tunnel (cloudflared.service — needs tunnel config)"
echo "  - Nginx reverse proxy (/ → Flask, /peerjs → PeerJS)"
echo "  - Ollama (offline fallback only — main AI on GPU server)"
echo "  - GitHub CLI (gh) installed"
echo ""
echo "New feature directories:"
echo "  ~/bmo/data/commands/   — custom slash command data"
echo "  ~/bmo/data/memory/     — auto-memory storage"
echo "  ~/bmo/data/dnd_sessions/ — D&D session persistence"
echo "  ~/bmo/.bmo/hooks/      — hook scripts (pre/post action)"
echo "  ~/bmo/.bmo/commands/   — custom slash commands"
echo ""
echo "IMPORTANT: Reboot required for PCIe/EEPROM changes!"
echo ""
echo "Next steps:"
echo "  1. Reboot: sudo reboot"
echo ""
echo "  2. After reboot, copy BMO app files to ~/bmo/"
echo "     scp -r pi-setup/bmo/* patrick@<pi-ip>:~/bmo/"
echo ""
echo "  3. Copy config files:"
echo "     scp pi-setup/config/credentials.json patrick@<pi-ip>:~/bmo/config/"
echo "     scp pi-setup/config/token.json patrick@<pi-ip>:~/bmo/config/"
echo ""
echo "  4. Transfer and register Modelfile:"
echo "     scp Modelfile patrick@<pi-ip>:~/bmo/"
echo "     ssh patrick@<pi-ip> 'ollama create bmo -f ~/bmo/Modelfile'"
echo ""
echo "  5. Configure Cloudflare Tunnel:"
echo "     cloudflared tunnel login"
echo "     cloudflared tunnel create bmo"
echo "     sudo systemctl start cloudflared.service"
echo ""
echo "  6. Set up YT Music auth (interactive, run manually):"
echo "     source ~/bmo/venv/bin/activate && ytmusicapi oauth"
echo ""
echo "  7. Verify hardware:"
echo "     libcamera-hello --timeout 5000   # Camera"
echo "     speaker-test -t wav              # Speakers"
echo "     arecord -d 5 test.wav && aplay test.wav  # Mic"
echo "     lsblk | grep nvme               # NVMe SSD"
echo ""
echo "  8. Start BMO:"
echo "     sudo systemctl start bmo.service"
echo ""
