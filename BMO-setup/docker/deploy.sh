#!/usr/bin/env bash
# deploy.sh — Deploy BMO to Raspberry Pi
#
# Usage (from Windows Git Bash or WSL):
#   bash deploy.sh              # Full deploy
#   bash deploy.sh --quick      # Skip deps install
#   bash deploy.sh --services   # Only restart services

set -euo pipefail

PI_USER="${PI_USER:-patrick}"
PI_IP="${PI_IP:-10.10.20.242}"
PI_DEST="${PI_USER}@${PI_IP}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BMO_DIR="$SCRIPT_DIR/.."

log()    { echo "[$(date +'%H:%M:%S')]   $*"; }
log_ok() { echo "[$(date +'%H:%M:%S')]   ✓ $*"; }

QUICK=false
SERVICES_ONLY=false
for arg in "$@"; do
    case "$arg" in
        --quick)    QUICK=true ;;
        --services) SERVICES_ONLY=true ;;
    esac
done

# ── Services-only mode ───────────────────────────────────────────────
if [ "$SERVICES_ONLY" = true ]; then
    log "Restarting BMO services..."
    ssh "$PI_DEST" "cd ~/bmo && docker compose up -d && sudo systemctl restart bmo"
    log_ok "Services restarted"
    exit 0
fi

# ── Full deploy ──────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  Deploying BMO to ${PI_DEST}"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. Create directories
log "[1/7] Creating directories..."
ssh "$PI_DEST" "mkdir -p ~/bmo/{config,models,data/{commands,memory,dnd_sessions,5e-references,5e,rag_data},templates,static/{css,js,img,faces,sounds},mcp_servers,.bmo/{hooks,commands},.audiocache}"

# 2. Copy Python services
log "[2/7] Copying Python services..."
scp "$BMO_DIR/pi/"*.py "$PI_DEST:~/bmo/"
scp "$BMO_DIR/pi/requirements.txt" "$PI_DEST:~/bmo/"
log_ok "Python files copied"

# 3. Copy agents
log "[3/7] Copying agents..."
scp -r "$BMO_DIR/pi/agents/" "$PI_DEST:~/bmo/agents/"
log_ok "Agents copied"

# 4. Copy MCP servers
log "[4/7] Copying MCP servers..."
scp -r "$BMO_DIR/pi/mcp_servers/" "$PI_DEST:~/bmo/mcp_servers/"
log_ok "MCP servers copied"

# 5. Copy templates + static + Docker config
log "[5/7] Copying templates, static, Docker config..."
scp "$BMO_DIR/pi/templates/index.html" "$PI_DEST:~/bmo/templates/"
scp "$BMO_DIR/pi/static/css/"*.css "$PI_DEST:~/bmo/static/css/" 2>/dev/null || true
scp "$BMO_DIR/pi/static/js/"*.js "$PI_DEST:~/bmo/static/js/" 2>/dev/null || true
scp "$BMO_DIR/pi/static/img/"*.png "$PI_DEST:~/bmo/static/img/" 2>/dev/null || true
scp "$BMO_DIR/docker/docker-compose.yml" "$PI_DEST:~/bmo/"
scp "$BMO_DIR/docker/bmo.service" "$PI_DEST:~/bmo/"
# Copy TV certs if present
scp "$BMO_DIR/pi/tv_cert.pem" "$BMO_DIR/pi/tv_key.pem" "$PI_DEST:~/bmo/" 2>/dev/null || true
log_ok "Assets copied"

# 6. Install dependencies (skip with --quick)
if [ "$QUICK" = false ]; then
    log "[6/7] Installing Python dependencies..."
    ssh "$PI_DEST" "source ~/bmo/venv/bin/activate && pip install -r ~/bmo/requirements.txt -q" \
        && log_ok "Python deps installed" \
        || log "  ⚠ pip install failed — run manually on Pi"
else
    log "[6/7] Skipping deps (--quick mode)"
fi

# 7. Start services
log "[7/7] Starting services..."
ssh "$PI_DEST" "cd ~/bmo && docker compose up -d" && log_ok "Docker services started"

# Install and start systemd service
ssh "$PI_DEST" "sudo cp ~/bmo/bmo.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable bmo && sudo systemctl restart bmo" \
    && log_ok "BMO service started" \
    || log "  ⚠ BMO service start failed"

# Health checks
echo ""
log "Health checks..."
sleep 3
ssh "$PI_DEST" "curl -sf http://localhost:5000/health 2>/dev/null && echo ' BMO Web UI: OK' || echo ' BMO Web UI: NOT READY'"
ssh "$PI_DEST" "curl -sf http://localhost:11434/api/tags 2>/dev/null && echo ' Ollama: OK' || echo ' Ollama: NOT READY (may still be starting)'"
ssh "$PI_DEST" "curl -sf http://localhost:9000/ 2>/dev/null && echo ' PeerJS: OK' || echo ' PeerJS: NOT READY'"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Deploy complete!"
echo ""
echo "  Web UI:  http://${PI_IP}:5000"
echo "  SSH:     ssh ${PI_DEST}"
echo "  Logs:    ssh ${PI_DEST} 'sudo journalctl -u bmo -f'"
echo "  Docker:  ssh ${PI_DEST} 'cd ~/bmo && docker compose logs -f'"
echo "═══════════════════════════════════════════════════════"
