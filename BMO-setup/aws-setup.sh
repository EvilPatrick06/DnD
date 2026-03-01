#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# AWS EC2 g5.xlarge GPU Server Setup — One-time automated setup
# NVIDIA A10G 24GB VRAM + 16GB RAM + 4 vCPU
# Ubuntu 24.04 on 100GB gp3 EBS
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${AI_DOMAIN:-ai.yourdomain.com}"
EMAIL="${CERTBOT_EMAIL:-you@yourdomain.com}"
AI_SERVER_KEY="${AI_SERVER_KEY:-}"
DATA_DIR="/opt/ai-server/data"
VENV_DIR="/opt/ai-server/venv"
APP_DIR="/opt/ai-server/app"

echo "═══════════════════════════════════════════════════════"
echo "  GPU AI Server Setup — EC2 g5.xlarge"
echo "  Domain: $DOMAIN"
echo "═══════════════════════════════════════════════════════"

# ── 1. System Update ──────────────────────────────────────────────────────
echo "→ [1/10] System update..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    build-essential git curl wget unzip \
    python3 python3-pip python3-venv \
    nginx certbot python3-certbot-nginx \
    ffmpeg sox libsndfile1 \
    jq htop tmux

# ── 2. NVIDIA Drivers + CUDA ─────────────────────────────────────────────
echo "→ [2/10] Installing NVIDIA drivers + CUDA..."

if ! command -v nvidia-smi &>/dev/null; then
    # Install NVIDIA driver (headless, no X11)
    apt-get install -y -qq linux-headers-$(uname -r)
    wget -q https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb
    dpkg -i cuda-keyring_1.1-1_all.deb
    apt-get update -qq
    apt-get install -y -qq cuda-toolkit-12-6 nvidia-headless-560 nvidia-utils-560
    rm -f cuda-keyring_1.1-1_all.deb

    # Add CUDA to PATH
    echo 'export PATH=/usr/local/cuda/bin:$PATH' >> /etc/profile.d/cuda.sh
    echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> /etc/profile.d/cuda.sh
    source /etc/profile.d/cuda.sh
fi

nvidia-smi || { echo "NVIDIA driver install failed!"; exit 1; }
echo "  ✓ NVIDIA driver installed"

# ── 3. Ollama ─────────────────────────────────────────────────────────────
echo "→ [3/10] Installing Ollama..."

if ! command -v ollama &>/dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
fi

systemctl enable ollama
systemctl start ollama

# Wait for Ollama to be ready
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        break
    fi
    sleep 2
done

echo "  ✓ Ollama running"

# Pull models (this takes a while — ~40GB for 70B Q4)
echo "  → Pulling Llama 3.1 70B Q4 (this will take 20-30 minutes)..."
ollama pull llama3.1:70b-instruct-q4_K_M || echo "  ⚠ 70B pull failed, will retry later"

echo "  → Pulling Qwen 2.5 32B Q5 (benchmark alternative)..."
ollama pull qwen2.5:32b-instruct-q5_K_M || echo "  ⚠ 32B pull failed, will retry later"

# Create BMO custom model from Modelfile
if [ -f "$APP_DIR/Modelfile" ]; then
    echo "  → Creating BMO custom model..."
    ollama create bmo -f "$APP_DIR/Modelfile"
    echo "  ✓ BMO model created"
fi

# ── 4. Python Environment ────────────────────────────────────────────────
echo "→ [4/10] Setting up Python environment..."

mkdir -p "$DATA_DIR/rag_data" "$DATA_DIR/voices/bmo" "$DATA_DIR/voices/npc" "$DATA_DIR/backups"
mkdir -p "$APP_DIR" "$VENV_DIR"

python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip setuptools wheel
if [ -f "$APP_DIR/requirements.txt" ]; then
    pip install -r "$APP_DIR/requirements.txt"
else
    echo "  ⚠ requirements.txt not found — install deps after copying app files"
fi

echo "  ✓ Python venv ready"

# ── 5. Fish Speech (TTS Voice Cloning) ───────────────────────────────────
echo "→ [5/10] Installing Fish Speech..."

FISH_DIR="/opt/fish-speech"
if [ ! -d "$FISH_DIR" ]; then
    git clone https://github.com/fishaudio/fish-speech.git "$FISH_DIR"
    cd "$FISH_DIR"
    pip install -e .
    cd -
    echo "  ✓ Fish Speech installed"
else
    echo "  ✓ Fish Speech already installed"
fi

# ── 6. faster-whisper (already in requirements.txt) ──────────────────────
echo "→ [6/10] Whisper Large-v3 will lazy-load on first STT request"

# ── 7. YOLOv8 (already in requirements.txt via ultralytics) ─────────────
echo "→ [7/10] YOLOv8-Large will lazy-load on first vision request"

# Pre-download the model weight file
python3 -c "from ultralytics import YOLO; YOLO('yolov8l.pt')" 2>/dev/null || true
echo "  ✓ YOLOv8-Large weights downloaded"

# ── 8. Systemd Service ──────────────────────────────────────────────────
echo "→ [8/10] Creating systemd service..."

cat > /etc/systemd/system/ai-server.service << 'UNIT'
[Unit]
Description=GPU AI Server (Flask)
After=network.target ollama.service
Requires=ollama.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ai-server/app
Environment=PATH=/opt/ai-server/venv/bin:/usr/local/cuda/bin:/usr/bin:/bin
Environment=AI_DATA_DIR=/opt/ai-server/data
Environment=OLLAMA_URL=http://localhost:11434
Environment=OLLAMA_MODEL=bmo
ExecStart=/opt/ai-server/venv/bin/gunicorn \
    --bind 127.0.0.1:8000 \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile /var/log/ai-server/access.log \
    --error-logfile /var/log/ai-server/error.log \
    ai_server:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

# Add API key to service if configured
if [ -n "$AI_SERVER_KEY" ]; then
    sed -i "/Environment=OLLAMA_MODEL=bmo/a Environment=AI_SERVER_KEY=$AI_SERVER_KEY" \
        /etc/systemd/system/ai-server.service
fi

mkdir -p /var/log/ai-server
systemctl daemon-reload
systemctl enable ai-server
systemctl start ai-server

# Verify service started
for i in {1..10}; do
    if systemctl is-active ai-server &>/dev/null; then
        echo "  ✓ ai-server.service running"; break
    fi
    sleep 1
done
systemctl is-active ai-server &>/dev/null || echo "  ⚠ ai-server may not have started — check: journalctl -u ai-server"

# ── 8b. Log Rotation ────────────────────────────────────────────────────
echo "→ [8b] Configuring logrotate for ai-server..."

cat > /etc/logrotate.d/ai-server << 'LOGROTATE'
/var/log/ai-server/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    postrotate
        systemctl reload ai-server 2>/dev/null || true
    endscript
}
LOGROTATE

echo "  ✓ logrotate configured (14-day retention, compressed)"

# ── 8c. Visual Studio Code ────────────────────────────────────────────
echo "→ [8c] Installing Visual Studio Code..."
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /tmp/ms.gpg
install -o root -g root -m 644 /tmp/ms.gpg /usr/share/keyrings/microsoft-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-archive-keyring.gpg] https://packages.microsoft.com/repos/code stable main" | tee /etc/apt/sources.list.d/vscode.list
apt-get update -qq && apt-get install -y -qq code
rm -f /tmp/ms.gpg
echo "  ✓ VS Code installed (use 'code tunnel' for remote access)"

# ── 8d. DnD Project Directory ─────────────────────────────────────────
echo "→ [8d] Setting up DnD project directory..."
mkdir -p /opt/dnd-project
chown $SUDO_USER:$SUDO_USER /opt/dnd-project 2>/dev/null || true
echo "  ✓ /opt/dnd-project ready for initial file copy"

# ── 9. Nginx + TLS ──────────────────────────────────────────────────────
echo "→ [9/10] Configuring Nginx + Let's Encrypt TLS..."

cat > /etc/nginx/sites-available/ai-server << NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Streaming support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # Large file uploads (audio, images)
        client_max_body_size 50M;
    }

    # Also proxy Ollama directly for VTT app compatibility
    location /api/ {
        proxy_pass http://127.0.0.1:11434/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_buffering off;
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ai-server /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Get TLS certificate
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" || \
    echo "  ⚠ Certbot failed — will need manual TLS setup"

echo "  ✓ Nginx configured"

# ── 10. Spot Interruption Handler ────────────────────────────────────────
echo "→ [10/10] Setting up spot interruption handler..."

cat > /opt/ai-server/spot-monitor.sh << 'SPOT'
#!/usr/bin/env bash
# Poll EC2 metadata for spot termination notice (2-min warning)
# Run as systemd service

TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)

while true; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-aws-ec2-metadata-token: $TOKEN" \
        "http://169.254.169.254/latest/meta-data/spot/instance-action" 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ]; then
        echo "$(date): SPOT INTERRUPTION DETECTED — graceful shutdown"

        # Gracefully stop services
        systemctl stop ai-server
        systemctl stop ollama

        # Flush logs
        sync

        echo "$(date): Services stopped, ready for termination"
        exit 0
    fi

    sleep 5
done
SPOT

chmod +x /opt/ai-server/spot-monitor.sh

cat > /etc/systemd/system/spot-monitor.service << 'UNIT'
[Unit]
Description=EC2 Spot Interruption Monitor
After=network.target

[Service]
Type=simple
ExecStart=/opt/ai-server/spot-monitor.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable spot-monitor
systemctl start spot-monitor

echo "  ✓ Spot monitor running"

# ── User Data Script (for spot re-launch) ────────────────────────────────
# This script runs on every new spot instance boot to reattach the EBS volume
# and restart services. Save this as the EC2 launch template user data.

cat > /opt/ai-server/user-data-template.sh << 'USERDATA'
#!/bin/bash
# EC2 User Data — runs on every spot instance boot
# Finds EBS volume by tag (no hardcoded ID needed) and reattaches

DEVICE="/dev/xvdf"
MOUNT="/opt/ai-server"

# Get instance metadata (IMDSv2)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/availability-zone)
REGION="${AZ%?}"  # Strip AZ letter to get region

# Find volume by tag instead of hardcoded ID
VOLUME_ID=$(aws ec2 describe-volumes \
    --filters "Name=tag:Name,Values=bmo-ai-data" "Name=availability-zone,Values=$AZ" \
    --query "Volumes[0].VolumeId" --output text --region "$REGION" 2>/dev/null)

if [ -z "$VOLUME_ID" ] || [ "$VOLUME_ID" = "None" ]; then
    echo "ERROR: No EBS volume with tag 'bmo-ai-data' found in $AZ"
    exit 1
fi

# Attach EBS volume if not already attached
if ! lsblk | grep -q xvdf; then
    aws ec2 attach-volume --volume-id "$VOLUME_ID" --instance-id "$INSTANCE_ID" \
        --device "$DEVICE" --region "$REGION"

    for i in {1..30}; do
        if lsblk | grep -q xvdf; then break; fi
        sleep 5
    done
fi

# Mount if not mounted
if ! mountpoint -q "$MOUNT"; then
    mkdir -p "$MOUNT"
    mount "$DEVICE" "$MOUNT"
fi

# Restart services
systemctl restart ollama
sleep 10
systemctl restart ai-server
systemctl restart spot-monitor
USERDATA

chmod +x /opt/ai-server/user-data-template.sh

# ── Done ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✓ GPU AI Server setup complete!"
echo ""
echo "  Services:"
echo "    - Ollama:     http://localhost:11434"
echo "    - AI Server:  http://localhost:8000"
echo "    - Public:     https://$DOMAIN"
echo ""
echo "  Models:"
nvidia-smi --query-gpu=gpu_name,memory.total --format=csv,noheader 2>/dev/null || echo "    (GPU info unavailable)"
ollama list 2>/dev/null || echo "    (Ollama models loading)"
echo ""
echo "  Next steps (run from Windows Git Bash):"
echo "    1. Deploy everything with one command:"
echo "       cd /c/Users/evilp/dnd/BMO-setup && bash bmo.sh deploy aws"
echo ""
echo "    Or manually:"
echo "    2. Copy Modelfile + ai_server.py to $APP_DIR/"
echo "    3. Copy BMO voice references to $DATA_DIR/voices/bmo/"
echo "    4. Copy NPC voice references to $DATA_DIR/voices/npc/"
echo "    5. Copy/build RAG indexes to $DATA_DIR/rag_data/"
echo "    6. Run: ollama create bmo -f $APP_DIR/Modelfile"
echo "    7. Restart: systemctl restart ai-server"
echo ""
echo "    VS Code Remote-SSH setup:"
echo "    8. Add to ~/.ssh/config on Pi and laptop:"
echo "         Host aws-dev"
echo "             HostName <ec2-ip>"
echo "             User ubuntu"
echo "             IdentityFile ~/.ssh/aws-key.pem"
echo "    9. VS Code: Ctrl+Shift+P → Remote-SSH: Connect → aws-dev → /opt/dnd-project"
echo "═══════════════════════════════════════════════════════"
