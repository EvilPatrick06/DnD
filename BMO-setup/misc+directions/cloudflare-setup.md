# Cloudflare Setup Guide

Step-by-step guide for configuring Cloudflare services for the BMO + VTT system.

Prerequisites:
- A Cloudflare account (free tier works for most of this)
- A domain added to Cloudflare (e.g., `yourdomain.com`)
- The Raspberry Pi with `cloudflared` already installed (via `pi-setup.sh`)
- The EC2 GPU server running with Nginx + TLS (via `aws-setup.sh`)

---

## 1. Cloudflare Tunnel Setup on Raspberry Pi

The Tunnel lets you expose the Pi's local services (Flask app, PeerJS) to the internet without opening any ports on your home router. All traffic is encrypted and routed through Cloudflare's network.

> **Automated option**: `post-setup-auth.sh` walks through tunnel setup interactively — it runs `cloudflared tunnel login`, creates the tunnel, generates `config.yml`, and sets up DNS routes automatically. Run on the Pi:
> ```bash
> bash ~/bmo/post-setup-auth.sh
> ```
> The manual steps below are for reference or if you prefer doing it by hand.

### 1.1 Authenticate cloudflared

SSH into the Pi and run:

```bash
cloudflared tunnel login
```

This opens a browser URL. Log in to your Cloudflare account and authorize the domain you want to use. A certificate is saved to `~/.cloudflared/cert.pem`.

### 1.2 Create the Tunnel

```bash
cloudflared tunnel create bmo
```

This creates a tunnel and outputs a Tunnel ID (UUID). Note it down. A credentials file is saved to `~/.cloudflared/<TUNNEL_ID>.json`.

Verify the tunnel exists:

```bash
cloudflared tunnel list
```

### 1.3 Create the Configuration File

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/patrick/.cloudflared/<TUNNEL_ID>.json

ingress:
  # BMO web UI and API (Flask app behind Nginx)
  - hostname: bmo.yourdomain.com
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  # PeerJS signaling server (for VTT WebRTC)
  - hostname: signaling.yourdomain.com
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  # Catch-all (required by cloudflared)
  - service: http_status:404
```

Replace `<TUNNEL_ID>` with the actual UUID from step 1.2 and `patrick` with your Pi username.

**Note**: Both `bmo.*` and `signaling.*` route to Nginx on port 80, which then proxies to the correct backend based on the URL path (`/` goes to Flask :5000, `/peerjs` goes to PeerJS :9000).

### 1.4 Test the Tunnel

Run it manually first to verify:

```bash
cloudflared tunnel run
```

You should see output like:

```
INF Connection established connIndex=0 ...
INF Connection established connIndex=1 ...
```

Test from another machine:

```bash
curl https://bmo.yourdomain.com/api/weather
```

### 1.5 Start as Systemd Service

The `pi-setup.sh` script already creates the systemd unit. Start it:

```bash
sudo systemctl start cloudflared.service
sudo systemctl status cloudflared.service
```

Check logs if something goes wrong:

```bash
sudo journalctl -u cloudflared -f
```

### 1.6 Verify Tunnel Health

From the Cloudflare dashboard:

1. Go to **Zero Trust** > **Networks** > **Tunnels**
2. Your `bmo` tunnel should show as **Healthy** with active connections

---

## 2. DNS Records

All DNS records are managed in the Cloudflare dashboard under your domain's DNS settings. The Tunnel automatically creates CNAME records when you route hostnames, but you should verify them.

### 2.1 Tunnel-Managed Records (Pi Services)

These are created automatically when you add hostnames to the tunnel config, but you can also create them manually:

```bash
# Create DNS routes for the tunnel
cloudflared tunnel route dns bmo bmo.yourdomain.com
cloudflared tunnel route dns bmo signaling.yourdomain.com
```

This creates CNAME records pointing to `<TUNNEL_ID>.cfargotunnel.com`.

Verify in the dashboard:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `bmo` | `<TUNNEL_ID>.cfargotunnel.com` | Proxied (orange cloud) |
| CNAME | `signaling` | `<TUNNEL_ID>.cfargotunnel.com` | Proxied (orange cloud) |

### 2.2 GPU Server Record

The EC2 GPU server uses its own TLS (Let's Encrypt) and does not go through the Tunnel. Create an A record pointing to the EC2 Elastic IP:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `ai` | `<EC2_ELASTIC_IP>` | DNS only (gray cloud) |

**Important**: Use "DNS only" (gray cloud), not "Proxied" (orange cloud), for the AI server. Cloudflare's proxy has a 100MB upload limit on free tier which would break large audio/image uploads, and it adds latency to streaming LLM responses.

If you do not have an Elastic IP, allocate one in the AWS console and associate it with your EC2 instance to ensure the IP persists across spot restarts.

### 2.3 Summary of All DNS Records

| Subdomain | Type | Target | Proxy Status | Purpose |
|-----------|------|--------|--------------|---------|
| `bmo.yourdomain.com` | CNAME | `<TUNNEL_ID>.cfargotunnel.com` | Proxied | BMO web UI + API |
| `signaling.yourdomain.com` | CNAME | `<TUNNEL_ID>.cfargotunnel.com` | Proxied | PeerJS signaling for VTT |
| `ai.yourdomain.com` | A | `<EC2_ELASTIC_IP>` | DNS only | GPU AI server |

---

## 3. R2 Bucket Setup (Map Images and Game Data CDN)

Cloudflare R2 is S3-compatible object storage with no egress fees. Use it to store and serve map images, game data files, and voice reference clips.

### 3.1 Create the Bucket

1. Go to **R2 Object Storage** in the Cloudflare dashboard
2. Click **Create bucket**
3. Name: `bmo-assets` (or `dnd-assets`)
4. Location hint: **North America** (closest to your EC2 region)
5. Click **Create bucket**

### 3.2 Enable Public Access via Custom Domain

1. In the bucket settings, go to **Settings** > **Public access**
2. Click **Connect Domain**
3. Enter: `assets.yourdomain.com`
4. Cloudflare automatically creates the DNS record

Now files in the bucket are accessible at `https://assets.yourdomain.com/<key>`.

### 3.3 Create API Token for Uploads

1. Go to **R2 Object Storage** > **Manage R2 API Tokens**
2. Click **Create API token**
3. Permissions: **Object Read & Write**
4. Specify bucket: `bmo-assets`
5. TTL: No expiration (or set a rotation schedule)
6. Save the **Access Key ID** and **Secret Access Key**

### 3.4 Upload Assets

Using the AWS CLI (R2 is S3-compatible):

```bash
# Configure the R2 endpoint
aws configure set default.s3.endpoint_url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# Upload map images
aws s3 cp ./maps/ s3://bmo-assets/maps/ --recursive \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# Upload game data
aws s3 cp ./data/5e/ s3://bmo-assets/data/5e/ --recursive \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# Upload voice reference clips
aws s3 cp ./voices/ s3://bmo-assets/voices/ --recursive \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Find your Account ID in the Cloudflare dashboard under **R2 Object Storage** > **Overview**.

### 3.5 Bucket Structure

```
bmo-assets/
  maps/
    dungeon-01.webp
    forest-clearing.webp
    tavern-interior.webp
    ...
  data/
    5e/
      classes.json
      spells.json
      monsters.json
      ...
  voices/
    bmo/
      calm.wav
      happy.wav
      dramatic.wav
    npc/
      gruff_dwarf.wav
      mysterious_elf.wav
      ...
```

### 3.6 CORS Configuration (if needed)

If the VTT Electron app or BMO web UI loads assets directly from R2, configure CORS:

1. Go to the bucket **Settings** > **CORS policy**
2. Add a rule:

```json
[
  {
    "AllowedOrigins": ["https://bmo.yourdomain.com", "http://localhost:5000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

---

## 4. Cloudflare Calls TURN Setup (VTT WebRTC)

Cloudflare Calls provides TURN relay servers so VTT players behind symmetric NAT or strict firewalls can establish WebRTC peer-to-peer connections.

### 4.1 Enable Cloudflare Calls

1. Go to **Calls** in the Cloudflare dashboard
2. If not already enabled, click **Get Started**
3. Calls is included in the free tier (100,000 participant-minutes/month)

### 4.2 Create a TURN App

1. In the Calls section, click **Create a new Calls app** (or **TURN Keys** if shown)
2. Name: `dnd-vtt-turn`
3. Note the **App ID** (also called Turn Key ID)
4. Note the **Token** (also called Turn Key API Token)

### 4.3 Generate TURN Credentials

TURN credentials are short-lived. Generate them via the Cloudflare API from your VTT app or server:

```bash
curl -X POST "https://rtc.live.cloudflare.com/v1/turn/keys/<APP_ID>/credentials/generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 86400}'
```

Response:

```json
{
  "iceServers": {
    "urls": [
      "stun:stun.cloudflare.com:3478",
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turn:turn.cloudflare.com:3478?transport=tcp",
      "turns:turn.cloudflare.com:5349?transport=tcp"
    ],
    "username": "<generated-username>",
    "credential": "<generated-credential>"
  }
}
```

### 4.4 Integrate with VTT PeerJS

In the VTT Electron app, pass the TURN credentials to PeerJS when creating the peer connection. The app should:

1. On startup, request TURN credentials from the GPU server (or a lightweight endpoint on the Pi)
2. Pass the `iceServers` config to the PeerJS constructor:

```typescript
const peer = new Peer(peerId, {
  host: 'signaling.yourdomain.com',
  port: 443,
  secure: true,
  path: '/peerjs',
  config: {
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turn:turn.cloudflare.com:3478?transport=tcp',
          'turns:turn.cloudflare.com:5349?transport=tcp'
        ],
        username: '<generated-username>',
        credential: '<generated-credential>'
      }
    ]
  }
});
```

### 4.5 Credential Rotation

TURN credentials expire after the TTL (default 24 hours). Set up automatic rotation:

- Generate new credentials on each VTT session start
- Or run a cron job / background task that refreshes credentials every 12 hours
- Store the current credentials in the Pi's BMO config or serve them via an API endpoint

---

## 5. SSL/TLS Configuration

### 5.1 Cloudflare Tunnel (Pi Services)

Traffic between users and Cloudflare is always encrypted (Cloudflare terminates TLS). The tunnel from Cloudflare to the Pi is also encrypted by default.

Verify your domain's SSL/TLS settings:

1. Go to **SSL/TLS** > **Overview**
2. Set encryption mode to **Full** (not Full Strict, since the Pi uses HTTP behind the tunnel)
3. Enable **Always Use HTTPS** under **SSL/TLS** > **Edge Certificates**

Settings to enable:
- **Always Use HTTPS**: On
- **Automatic HTTPS Rewrites**: On
- **Minimum TLS Version**: TLS 1.2
- **TLS 1.3**: Enabled
- **HSTS**: Enable if you want (recommended for production)

### 5.2 EC2 GPU Server

The GPU server uses Let's Encrypt certificates managed by Certbot + Nginx (configured by `aws-setup.sh`).

Verify the certificate:

```bash
curl -vI https://ai.yourdomain.com/health 2>&1 | grep -E "subject:|expire"
```

Auto-renewal is handled by Certbot's systemd timer. Verify:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

### 5.3 Edge Rules (Optional)

For additional security, add a Cloudflare WAF rule to block non-browser traffic to the BMO UI:

1. Go to **Security** > **WAF** > **Custom rules**
2. Create a rule:
   - Name: `Block non-HTTPS`
   - Expression: `(not ssl)`
   - Action: **Block**

### 5.4 Full Configuration Checklist

| Setting | Location | Value |
|---------|----------|-------|
| SSL/TLS Mode | SSL/TLS > Overview | Full |
| Always Use HTTPS | SSL/TLS > Edge Certificates | On |
| Auto HTTPS Rewrites | SSL/TLS > Edge Certificates | On |
| Min TLS Version | SSL/TLS > Edge Certificates | 1.2 |
| TLS 1.3 | SSL/TLS > Edge Certificates | Enabled |
| HSTS | SSL/TLS > Edge Certificates | Optional (enable for production) |
| ai.* proxy status | DNS | DNS only (gray cloud) |
| bmo.* proxy status | DNS | Proxied (orange cloud) |
| signaling.* proxy status | DNS | Proxied (orange cloud) |

---

## Quick Reference: All Cloudflare Resources

| Resource | Type | Purpose |
|----------|------|---------|
| `bmo` tunnel | Tunnel | Exposes Pi services |
| `bmo.yourdomain.com` | DNS CNAME | BMO web UI |
| `signaling.yourdomain.com` | DNS CNAME | PeerJS signaling |
| `ai.yourdomain.com` | DNS A record | GPU server |
| `assets.yourdomain.com` | R2 custom domain | Game assets CDN |
| `bmo-assets` | R2 bucket | Map images, data, voices |
| `dnd-vtt-turn` | Calls TURN app | WebRTC relay |
