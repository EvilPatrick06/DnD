#!/bin/bash
# post-setup-auth.sh — Walk through all interactive authentication steps
# Run ON the Raspberry Pi after pi-setup.sh and bmo.sh deploy pi are done.
# Called automatically by: bash bmo.sh auth
#
# These steps require browser/interactive input and can't be fully automated.
# This script guides you through each one with prompts.

set -e

BMO_DIR="$HOME/bmo"
VENV="$BMO_DIR/venv/bin/activate"

echo "═══════════════════════════════════════════════════════"
echo "  BMO Post-Setup Authentication"
echo "  This walks through all interactive auth steps."
echo "═══════════════════════════════════════════════════════"
echo ""

press_enter() {
    echo ""
    read -rp "Press Enter when done (or 's' to skip)... " choice
    [ "$choice" = "s" ] && return 1 || return 0
}

# ── 1. Cloudflare Tunnel ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [1/4] Cloudflare Tunnel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -d "$HOME/.cloudflared" ] && ls "$HOME/.cloudflared/"*.json &>/dev/null; then
    echo "  Cloudflare tunnel credentials found — already configured"
    TUNNEL_ID=$(ls "$HOME/.cloudflared/"*.json 2>/dev/null | head -1 | xargs basename | sed 's/.json//')
    echo "  Tunnel ID: $TUNNEL_ID"
else
    echo "  Step 1: Login to Cloudflare (opens browser)"
    echo "    This will open a URL — authorize in your browser."
    echo ""
    if press_enter; then
        cloudflared tunnel login
        echo ""
        echo "  Step 2: Create tunnel"
        cloudflared tunnel create bmo
        TUNNEL_ID=$(cloudflared tunnel list --output json 2>/dev/null | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
        echo "  Tunnel ID: $TUNNEL_ID"

        echo ""
        echo "  Step 3: Create DNS routes"
        read -rp "  Enter your domain (e.g. yourdomain.com): " DOMAIN
        cloudflared tunnel route dns bmo "bmo.${DOMAIN}" || echo "  (route may already exist)"
        cloudflared tunnel route dns bmo "signaling.${DOMAIN}" || echo "  (route may already exist)"

        echo ""
        echo "  Step 4: Writing config file..."
        CRED_FILE=$(ls "$HOME/.cloudflared/"*.json 2>/dev/null | head -1)
        mkdir -p "$HOME/.cloudflared"
        cat > "$HOME/.cloudflared/config.yml" << CFEOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED_FILE}

ingress:
  - hostname: bmo.${DOMAIN}
    service: http://localhost:80
  - hostname: signaling.${DOMAIN}
    service: http://localhost:9000
  - service: http_status:404
CFEOF
        echo "  Config written to ~/.cloudflared/config.yml"

        echo ""
        echo "  Step 5: Starting tunnel service..."
        sudo systemctl start cloudflared
        sudo systemctl status cloudflared --no-pager -l || true
        echo "  Cloudflare Tunnel configured!"
    else
        echo "  Skipped Cloudflare Tunnel setup"
    fi
fi

echo ""

# ── 2. Google Calendar ───────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [2/4] Google Calendar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "$BMO_DIR/config/token.json" ]; then
    echo "  Google Calendar token found — already authorized"
else
    echo "  This requires credentials.json from Google Cloud Console."
    echo "  If you haven't copied it yet, run from your PC first:"
    echo "    scp config/credentials.json $(whoami)@$(hostname -I | awk '{print $1}'):~/bmo/config/"
    echo ""
    if [ -f "$BMO_DIR/config/credentials.json" ]; then
        echo "  credentials.json found — starting OAuth flow..."
        if press_enter; then
            source "$VENV"
            python3 "$BMO_DIR/authorize_calendar.py" 2>/dev/null || \
                python3 -c "
from google_auth_oauthlib.flow import InstalledAppFlow
flow = InstalledAppFlow.from_client_secrets_file(
    '$BMO_DIR/config/credentials.json',
    ['https://www.googleapis.com/auth/calendar.readonly']
)
creds = flow.run_local_server(port=0)
import json
with open('$BMO_DIR/config/token.json', 'w') as f:
    f.write(creds.to_json())
print('Token saved!')
"
            echo "  Google Calendar authorized!"
        else
            echo "  Skipped Google Calendar setup"
        fi
    else
        echo "  credentials.json not found — skipping"
        echo "  Copy it and re-run this script later"
    fi
fi

echo ""

# ── 3. YouTube Music ────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [3/4] YouTube Music"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "$HOME/oauth.json" ] || [ -f "$BMO_DIR/oauth.json" ]; then
    echo "  YouTube Music OAuth token found — already authorized"
else
    echo "  This opens a browser for Google OAuth."
    echo "  You'll need to sign in with the Google account that has YT Music."
    echo ""
    if press_enter; then
        source "$VENV"
        cd "$BMO_DIR"
        ytmusicapi oauth
        cd -
        echo "  YouTube Music authorized!"
    else
        echo "  Skipped YouTube Music setup"
    fi
fi

echo ""

# ── 4. Hardware Verification ────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [4/4] Hardware Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "  Running quick hardware checks..."
echo ""

# Camera
echo -n "  Camera:    "
if libcamera-hello --timeout 1000 --nopreview &>/dev/null; then
    echo "OK"
else
    echo "NOT DETECTED (check FPC cable)"
fi

# Audio output
echo -n "  Speakers:  "
if aplay -l 2>/dev/null | grep -q "card"; then
    echo "OK ($(aplay -l 2>/dev/null | grep 'card' | head -1 | sed 's/.*: //'))"
else
    echo "NOT DETECTED"
fi

# Microphone
echo -n "  Mic:       "
if arecord -l 2>/dev/null | grep -q "card"; then
    echo "OK ($(arecord -l 2>/dev/null | grep 'card' | head -1 | sed 's/.*: //'))"
else
    echo "NOT DETECTED"
fi

# NVMe
echo -n "  NVMe:      "
if lsblk 2>/dev/null | grep -q "nvme"; then
    SIZE=$(lsblk -d -o NAME,SIZE 2>/dev/null | grep nvme | awk '{print $2}')
    echo "OK ($SIZE)"
else
    echo "NOT DETECTED"
fi

# OLED
echo -n "  I2C/OLED:  "
if i2cdetect -y 1 2>/dev/null | grep -q "3c"; then
    echo "OK (address 0x3c)"
else
    echo "NOT DETECTED (check I2C enabled)"
fi

# Ollama
echo -n "  Ollama:    "
if curl -s http://localhost:11434/api/tags &>/dev/null; then
    MODELS=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | tr '\n' ', ' | sed 's/,$//')
    echo "OK (models: $MODELS)"
else
    echo "NOT RUNNING"
fi

# BMO service
echo -n "  BMO:       "
if systemctl is-active bmo &>/dev/null; then
    echo "RUNNING"
else
    echo "NOT RUNNING (sudo systemctl start bmo)"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Post-setup auth complete!"
echo ""
echo "  To re-run any step, run this script again."
echo "  Already-configured steps will be skipped."
echo "═══════════════════════════════════════════════════════"
