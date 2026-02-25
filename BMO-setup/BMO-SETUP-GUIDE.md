# BMO Setup Guide

Complete from-scratch guide to building BMO — a two-system AI assistant combining a Raspberry Pi 5 physical device with an AWS EC2 GPU server, connected through Cloudflare.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [AWS Region & Infrastructure](#3-aws-region--infrastructure)
4. [Cost Management & Budgeting](#4-cost-management--budgeting)
5. [IAM & Security](#5-iam--security)
6. [EC2 GPU Server Setup](#6-ec2-gpu-server-setup)
7. [Raspberry Pi Setup](#7-raspberry-pi-setup)
8. [Cloudflare Setup](#8-cloudflare-setup)
9. [Deployment](#9-deployment)
10. [Configuration Reference](#10-configuration-reference)
11. [Monitoring & Maintenance](#11-monitoring--maintenance)
12. [Troubleshooting](#12-troubleshooting)
13. [Security Hardening Checklist](#13-security-hardening-checklist)

---

## 1. Prerequisites

### 1.1 Hardware Shopping List

| Item | Model / Spec | Purpose | Approx Cost |
|------|-------------|---------|-------------|
| Raspberry Pi 5 | 8GB RAM | Main BMO compute | $80 |
| Freenove Computer Case Kit | For Pi 5 | Case + OLED + RGB LEDs + fans + expansion board | $35 |
| Pi Camera Module 3 | Standard (not wide) | Vision, face recognition | $25 |
| USB Microphone | Any USB condenser mic | Wake word + voice input | $15 |
| Speakers | 3.5mm powered speakers | TTS audio output | $15 |
| NVMe SSD | 256GB+ M.2 2280 | Fast storage (via Freenove PCIe adapter) | $25 |
| Freenove Touchscreen | 7" DSI display | Kiosk UI | $55 |
| USB-C Power Supply | 27W (5V/5A) official Pi PSU | Stable power for Pi 5 | $12 |
| MicroSD Card | 32GB+ (for initial OS flash) | Boot media | $8 |

**Total hardware: ~$270 one-time**

### 1.2 Cloud Accounts

| Account | URL | Tier |
|---------|-----|------|
| AWS | https://aws.amazon.com | Free tier + paid (GPU instance) |
| Cloudflare | https://dash.cloudflare.com | Free tier |
| GitHub | https://github.com | Free tier |
| Google Cloud | https://console.cloud.google.com | Free tier (Calendar API only) |

### 1.3 API Keys & Credentials to Gather

Before starting, collect or generate:

- **Domain name** registered and added to Cloudflare (e.g., `yourdomain.com`)
- **AWS access key** for CLI operations
- **SSH key pair** (Ed25519 recommended) for Pi and EC2 access
- **Google Calendar OAuth** credentials (if using calendar integration)
- **Google Maps API key** (if using weather/location features)
- **YouTube Music OAuth** token (if using music playback)
- **GPU server API key** — generate later with `openssl rand -hex 32`

### 1.4 Local Dev Machine Requirements

Your Windows PC needs:

- **Git Bash** (comes with Git for Windows)
- **SSH client** (built into Windows 10+ or via Git Bash)
- **AWS CLI v2** — `winget install Amazon.AWSCLI`
- **SCP** (comes with Git Bash / OpenSSH)
- **Node.js** (for VTT development, already installed if working on the D&D app)

### 1.5 Time Estimate

| Phase | Time |
|-------|------|
| Hardware assembly | 30 min |
| Pi OS flash + first boot | 15 min |
| Pi setup script (`pi-setup.sh`) | 45 min (mostly downloads) |
| AWS account + EC2 launch | 30 min |
| GPU server setup (`aws-setup.sh`) | 30 min (mostly model downloads) |
| Cloudflare configuration | 20 min |
| Deployment + verification | 15 min |
| **Total** | **~3 hours** |

---

## 2. Architecture Overview

### 2.1 System Diagram

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
|   - Voice Pipeline  |  |   - /tts            |
|   - Camera Service  |  |   - /stt            |
|   - Music Service   |  |   - /vision/detect  |
|   - Smart Home      |  |   - /health         |
|   - D&D DM Mode     |  |                     |
|                     |  |  Ollama :11434      |
|  PeerJS Server :9000|  |   - bmo (Llama 3.1  |
|  Ollama (fallback)  |  |     70B Q4_K_M)     |
|   - bmo (Gemma3:4b) |  |                     |
|                     |  |  Fish Speech (TTS)  |
|  cloudflared tunnel |  |  Whisper Large-v3   |
+---------------------+  |  YOLOv8-Large       |
                          |  Nginx + TLS :443   |
                          +---------------------+
```

### 2.2 AI Routing (GPU Primary, Local Fallback)

Every AI call on the Pi follows: try GPU server first, fall back to local.

```
Request → Check GPU /health (30s cache) → OK? → GPU Server → Response
                                        → FAIL? → Local Ollama → Response
```

| Service | GPU (Primary) | Local (Fallback) |
|---------|--------------|-----------------|
| LLM | Llama 3.1 70B Q4 (32K ctx) | Gemma3:4b (8K ctx) |
| STT | Whisper Large-v3 (CUDA fp16) | Whisper base (CPU int8) |
| TTS | Fish Speech (voice-cloned) | Piper TTS + sox pitch shift |
| Vision | YOLOv8-Large (CUDA) | YOLOv8-Nano (CPU) |

### 2.3 Port Map

| Port | Service | Location |
|------|---------|----------|
| 5000 | BMO Flask app | Pi |
| 9000 | PeerJS signaling server | Pi |
| 80 | Nginx reverse proxy | Pi |
| 11434 | Ollama (local/primary) | Pi + EC2 |
| 8000 | AI Server (Gunicorn) | EC2 |
| 443 | Nginx + TLS (HTTPS) | EC2 |

### 2.4 Data Flows

**Voice Pipeline**: Microphone → Wake word (openwakeword) → Record until silence → Speaker ID (resemblyzer) → STT (Whisper) → Agent (LLM) → TTS (Fish Speech/Piper) → Speakers

**Vision Pipeline**: Pi Camera → Capture frame → Object detection (YOLO) / Scene description (LLM) / Face recognition → JSON/text response

**D&D DM Mode**: Player input → Agent with DM system prompt + RAG knowledge → Parse response tags (`[FACE:combat]`, `[LED:red]`, `[SOUND:sword]`, `[MUSIC:combat]`) → TTS with NPC voice profiles → Save to session log

**VTT Integration**: Electron app → LLM calls to GPU server → RAG search (dnd domain) → PeerJS signaling via Pi → WebRTC P2P via Cloudflare TURN

---

## 3. AWS Region & Infrastructure

### 3.1 Region Selection for Colorado Springs

| Region | Latency from CO | g5 Spot Price | g5 Availability | Recommendation |
|--------|----------------|---------------|-----------------|----------------|
| **us-west-2 (Oregon)** | ~35ms | ~$0.30/hr | Excellent | **Primary choice** |
| us-east-1 (Virginia) | ~45ms | ~$0.30/hr | Largest capacity | Backup option |
| us-west-1 (N. California) | ~40ms | N/A | **No g5 instances** | Avoid |
| us-west-2-den-1a (Denver LZ) | ~5ms | N/A | No GPU instances | Skip |

**Recommendation: us-west-2 (Oregon)**
- Best g5.xlarge spot pricing with consistent availability
- <40ms latency from Colorado Springs (acceptable for AI API calls)
- Multiple AZs for spot capacity diversity

> Note: The plan references us-east-1 in some existing configs. Either region works. If you already have infrastructure in us-east-1, stay there. For a fresh build from Colorado Springs, us-west-2 is slightly better on latency.

### 3.2 Availability Zones

Spread spot requests across multiple AZs for better capacity:

```bash
# Check spot pricing across AZs
aws ec2 describe-spot-price-history \
  --instance-types g5.xlarge \
  --product-descriptions "Linux/UNIX" \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --region us-west-2 \
  --query "SpotPriceHistory[*].[AvailabilityZone,SpotPrice,Timestamp]" \
  --output table
```

Use `capacity-optimized` allocation strategy in your spot request to let AWS pick the AZ with most available capacity.

### 3.3 VPC & Subnet Design

Use the **default VPC** — no custom VPC needed for this setup:

```bash
# Verify default VPC exists
aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[*].[VpcId,CidrBlock]" --output table
```

### 3.4 Security Group Rules

Create a security group for the AI server:

```bash
# Create security group
aws ec2 create-security-group \
  --group-name bmo-ai-server-sg \
  --description "BMO AI GPU Server"

# Allow HTTPS from anywhere
aws ec2 authorize-security-group-ingress \
  --group-name bmo-ai-server-sg \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

# Allow SSH from home IP only
aws ec2 authorize-security-group-ingress \
  --group-name bmo-ai-server-sg \
  --protocol tcp --port 22 --cidr "$(curl -s ifconfig.me)/32"
```

| Direction | Port | Protocol | Source | Purpose |
|-----------|------|----------|--------|---------|
| Inbound | 443 | TCP | 0.0.0.0/0 | HTTPS (AI API) |
| Inbound | 22 | TCP | `<HOME_IP>/32` | SSH (restricted) |
| Outbound | All | All | 0.0.0.0/0 | Default allow-all |

### 3.5 Elastic IP Allocation

Allocate an Elastic IP so the AI server's IP persists across spot restarts:

```bash
# Allocate
aws ec2 allocate-address --domain vpc

# Associate with instance (after launch)
aws ec2 associate-address \
  --instance-id <INSTANCE_ID> \
  --allocation-id <ALLOCATION_ID>
```

Free while attached to a running instance. $0.005/hr (~$3.60/mo) if unattached.

---

## 4. Cost Management & Budgeting

### 4.1 Monthly Cost Breakdown

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| EC2 g5.xlarge spot | ~$216 | ~$0.30/hr x 720hr/mo |
| EBS 100GB gp3 | ~$8 | Persistent storage |
| S3 backups | ~$2 | Daily backups + lifecycle |
| Route 53 | ~$1 | Hosted zone + queries |
| Elastic IP | Free | While attached to running instance |
| Cloudflare (all) | Free | Tunnel, R2 (10GB), Calls (1000GB) |
| Pi electricity | ~$3 | ~5W average |
| Domain (amortized) | ~$1 | ~$12/year |
| **Total** | **~$231/mo** | |

### 4.2 AWS Budget Alerts

Set up billing alerts to avoid surprise charges:

```bash
# Create SNS topic for budget alerts
aws sns create-topic --name bmo-budget-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<ACCOUNT_ID>:bmo-budget-alerts \
  --protocol email \
  --notification-endpoint your@email.com

# Create monthly budget with alerts at 80%, 100%, 120%
aws budgets create-budget \
  --account-id <ACCOUNT_ID> \
  --budget '{
    "BudgetName": "bmo-monthly",
    "BudgetLimit": {"Amount": "250", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{"SubscriptionType": "SNS", "Address": "arn:aws:sns:us-east-1:<ACCOUNT_ID>:bmo-budget-alerts"}]
    },
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 100,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{"SubscriptionType": "SNS", "Address": "arn:aws:sns:us-east-1:<ACCOUNT_ID>:bmo-budget-alerts"}]
    },
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 120,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{"SubscriptionType": "SNS", "Address": "arn:aws:sns:us-east-1:<ACCOUNT_ID>:bmo-budget-alerts"}]
    }
  ]'
```

### 4.3 CloudWatch Billing Alarms

```bash
# Create SNS topic (if not done above)
aws sns create-topic --name bmo-billing-alarm

# Create billing alarm: alert when estimated charges exceed $250
aws cloudwatch put-metric-alarm \
  --alarm-name "bmo-billing-250" \
  --alarm-description "BMO monthly bill exceeds $250" \
  --namespace "AWS/Billing" \
  --metric-name EstimatedCharges \
  --dimensions Name=Currency,Value=USD \
  --statistic Maximum \
  --period 21600 \
  --threshold 250 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<ACCOUNT_ID>:bmo-billing-alarm
```

> Note: Billing alarms must be created in us-east-1 regardless of your primary region.

### 4.4 Spot Instance Strategy

**Check spot pricing history:**

```bash
aws ec2 describe-spot-price-history \
  --instance-types g5.xlarge \
  --product-descriptions "Linux/UNIX" \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --query "SpotPriceHistory[*].[AvailabilityZone,SpotPrice,Timestamp]" \
  --output table | head -30
```

**Request a persistent spot instance:**

```bash
aws ec2 request-spot-instances \
  --spot-price "0.40" \
  --instance-count 1 \
  --type "persistent" \
  --launch-specification '{
    "ImageId": "ami-xxxxxxxxx",
    "InstanceType": "g5.xlarge",
    "KeyName": "your-key",
    "SecurityGroupIds": ["sg-xxxxxxxxx"],
    "IamInstanceProfile": {"Name": "bmo-ec2-role"},
    "BlockDeviceMappings": [{
      "DeviceName": "/dev/sda1",
      "Ebs": {"VolumeSize": 100, "VolumeType": "gp3", "DeleteOnTermination": false}
    }]
  }'
```

Key settings:
- **`capacity-optimized`** allocation — lets AWS pick the AZ with most spare capacity
- **Persistent spot request** — auto-relaunches when capacity returns after interruption
- **Maximum price cap: $0.40/hr** — safety net against price spikes (on-demand is $1.006/hr)
- **EBS `DeleteOnTermination: false`** — volume survives spot termination

### 4.5 Reserved vs Spot Analysis

| Option | $/hr | $/mo | Savings vs On-Demand |
|--------|------|------|---------------------|
| On-demand | $1.006 | $724 | — |
| 1yr RI (no upfront) | ~$0.64 | ~$460 | 36% |
| 3yr RI (all upfront) | ~$0.38 | ~$274 | 62% |
| **Spot** | **~$0.30** | **~$216** | **70%** |

**Recommendation: Spot** — best price, and BMO's architecture already handles interruptions gracefully. The Pi falls back to local models during spot gaps, and the persistent spot request auto-relaunches when capacity returns.

### 4.6 Cost-Saving Tactics

- **Schedule GPU downtime**: Stop the instance during sleep hours (midnight-8am) to save ~33% (~$72/mo)
- **Right-size**: g5.xlarge (1x A10G) is sufficient — don't use g5.2xlarge
- **Lazy model loading**: VRAM only consumed when features are used (Whisper, YOLO, RAG load on first request)
- **R2 free tier**: 10GB storage, 10M class B reads/mo — covers all VTT assets
- **Cloudflare free tier**: Tunnel, DNS, Calls (1000GB relay), CDN — all free
- **CloudWatch free tier**: 10 alarms, 5GB log ingestion, 3 dashboards

---

## 5. IAM & Security

### 5.1 IAM Users and Roles

| Principal | Type | Purpose |
|-----------|------|---------|
| `bmo-ec2-role` | EC2 Instance Role | S3 backup read/write, CloudWatch metrics from GPU server |
| `bmo-pi-user` | IAM User | S3 backup uploads from Pi, EC2 describe (spot status checks) |

**EC2 Instance Role Policy (`bmo-ec2-policy`):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BackupAccess",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::bmo-backups-*",
        "arn:aws:s3:::bmo-backups-*/*",
        "arn:aws:s3:::vtt-cloud-sync-*",
        "arn:aws:s3:::vtt-cloud-sync-*/*"
      ]
    },
    {
      "Sid": "CloudWatchMetrics",
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData"],
      "Resource": "*"
    }
  ]
}
```

**Pi IAM User Policy (`bmo-pi-policy`):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BackupUpload",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::bmo-backups-*",
        "arn:aws:s3:::bmo-backups-*/*"
      ]
    },
    {
      "Sid": "EC2SpotStatus",
      "Effect": "Allow",
      "Action": ["ec2:DescribeSpotInstanceRequests", "ec2:DescribeInstances"],
      "Resource": "*"
    }
  ]
}
```

**Create the role and user:**

```bash
# Create EC2 instance role
aws iam create-role --role-name bmo-ec2-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam put-role-policy --role-name bmo-ec2-role \
  --policy-name bmo-ec2-policy \
  --policy-document file://bmo-ec2-policy.json

aws iam create-instance-profile --instance-profile-name bmo-ec2-role
aws iam add-role-to-instance-profile \
  --instance-profile-name bmo-ec2-role \
  --role-name bmo-ec2-role

# Create Pi IAM user
aws iam create-user --user-name bmo-pi-user
aws iam put-user-policy --user-name bmo-pi-user \
  --policy-name bmo-pi-policy \
  --policy-document file://bmo-pi-policy.json
```

### 5.2 Access Key Management

```bash
# Generate access key for Pi user
aws iam create-access-key --user-name bmo-pi-user
```

Store on the Pi at `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
region = us-west-2
```

**NEVER commit credentials to git.** Add `~/.aws/` to your global gitignore.

### 5.3 API Key Setup

Generate a shared API key for the GPU server:

```bash
openssl rand -hex 32
```

**Store on Pi:** `~/bmo/data/settings.json`

```json
{
  "llm": {
    "gpu_server_url": "https://ai.yourdomain.com",
    "gpu_server_key": "<generated-key>"
  }
}
```

**Store on EC2:** In the systemd service environment:

```ini
# /etc/systemd/system/ai-server.service
[Service]
Environment=AI_SERVER_KEY=<generated-key>
```

### 5.4 SSH Key Setup

```bash
# Generate Ed25519 key pair (on your Windows PC)
ssh-keygen -t ed25519 -C "bmo-admin" -f ~/.ssh/bmo_ed25519

# Copy public key to Pi
ssh-copy-id -i ~/.ssh/bmo_ed25519.pub patrick@<PI_IP>

# Copy public key to EC2 (add to launch template or manually)
ssh -i ~/.ssh/existing-key.pem ubuntu@<EC2_IP> \
  "echo '$(cat ~/.ssh/bmo_ed25519.pub)' >> ~/.ssh/authorized_keys"
```

**Disable password auth** on both Pi and EC2:

```bash
# Edit sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

**SSH config shortcuts** (`~/.ssh/config`):

```
Host bmo-pi
    HostName <PI_IP>
    User patrick
    IdentityFile ~/.ssh/bmo_ed25519

Host bmo-gpu
    HostName <ELASTIC_IP>
    User ubuntu
    IdentityFile ~/.ssh/bmo_ed25519
```

### 5.5 Secrets Inventory

| Secret | Location | Purpose |
|--------|----------|---------|
| SSH private key | `~/.ssh/bmo_ed25519` (local PC) | SSH access to Pi + EC2 |
| AWS access key | `~/.aws/credentials` (Pi) | S3 backups, EC2 describe |
| GPU API key | `~/bmo/data/settings.json` (Pi) | Auth to GPU server |
| GPU API key | systemd env (EC2) | API key validation |
| Google OAuth | `~/bmo/config/credentials.json` (Pi) | Calendar API |
| Google token | `~/bmo/config/token.json` (Pi) | Calendar API |
| Cloudflare tunnel creds | `~/.cloudflared/<ID>.json` (Pi) | Tunnel auth |
| R2 API token | AWS CLI config or env var | R2 uploads |
| TURN app token | App config | WebRTC TURN credential generation |

### 5.6 Key Rotation Schedule

Rotate keys every 90 days:

| Key | Rotation Steps |
|-----|---------------|
| AWS access key | 1. `aws iam create-access-key --user-name bmo-pi-user` 2. Update `~/.aws/credentials` on Pi 3. Verify: `aws s3 ls` 4. Delete old key: `aws iam delete-access-key --user-name bmo-pi-user --access-key-id <OLD_ID>` |
| GPU API key | 1. `openssl rand -hex 32` 2. Update `~/bmo/data/settings.json` on Pi 3. Update systemd env on EC2 4. `sudo systemctl daemon-reload && sudo systemctl restart ai-server` |
| SSH key | 1. Generate new key pair 2. Add new public key to Pi + EC2 3. Test new key 4. Remove old public key from `~/.ssh/authorized_keys` |

---

## 6. EC2 GPU Server Setup

### 6.1 Launch Template Creation

Create a launch template via the AWS console or CLI:

```bash
aws ec2 create-launch-template \
  --launch-template-name bmo-gpu-server \
  --launch-template-data '{
    "ImageId": "ami-0c7217cdde317cfec",
    "InstanceType": "g5.xlarge",
    "KeyName": "bmo_ed25519",
    "SecurityGroupIds": ["sg-xxxxxxxxx"],
    "IamInstanceProfile": {"Name": "bmo-ec2-role"},
    "BlockDeviceMappings": [{
      "DeviceName": "/dev/sda1",
      "Ebs": {
        "VolumeSize": 100,
        "VolumeType": "gp3",
        "DeleteOnTermination": false
      }
    }],
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [{"Key": "Name", "Value": "bmo-ai-server"}]
    }]
  }'
```

> Use the latest Ubuntu 24.04 LTS AMI for your region. Find it with:
> ```bash
> aws ec2 describe-images --owners 099720109477 \
>   --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
>   --query "Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]" --output table
> ```

### 6.2 Running aws-setup.sh

1. Launch the spot instance from the template
2. SSH in and copy files:

```bash
# From your Windows PC
scp BMO-setup/aws-setup.sh ubuntu@<ELASTIC_IP>:/tmp/
scp BMO-setup/AWS/ai_server.py BMO-setup/AWS/requirements.txt BMO-setup/AWS/Modelfile \
    ubuntu@<ELASTIC_IP>:/opt/ai-server/app/

# SSH in
ssh ubuntu@<ELASTIC_IP>

# Run setup (takes ~30 min, mostly model downloads)
sudo AI_DOMAIN=ai.yourdomain.com \
     CERTBOT_EMAIL=you@yourdomain.com \
     AI_SERVER_KEY=<your-api-key> \
     bash /tmp/aws-setup.sh
```

**Expected output per phase:**

| Step | Output | Duration |
|------|--------|----------|
| [1/10] System update | Package installs | 2 min |
| [2/10] NVIDIA drivers | CUDA toolkit + headless driver | 5 min |
| [3/10] Ollama + models | Llama 3.1 70B (~40GB) + Qwen 32B | 20 min |
| [4/10] Python env | venv + pip packages | 3 min |
| [5/10] Fish Speech | Git clone + install | 2 min |
| [6-7/10] Whisper + YOLO | Lazy load (just messages) | instant |
| [8/10] Systemd service | ai-server.service created | instant |
| [8b] Logrotate | 14-day compressed log rotation | instant |
| [9/10] Nginx + TLS | Certbot certificate | 1 min |
| [10/10] Spot monitor | Interruption handler | instant |

### 6.3 Post-Setup Verification

```bash
# GPU check
nvidia-smi
# Should show: NVIDIA A10G, 24GB, driver 560.x, CUDA 12.6

# Ollama models
ollama list
# Should show: bmo, llama3.1:70b-instruct-q4_K_M, qwen2.5:32b-instruct-q5_K_M

# Health endpoint
curl http://localhost:8000/health
# Should show: {"status": "ok", "ollama": true, ...}

# TLS check
curl -vI https://ai.yourdomain.com/health 2>&1 | grep -E "subject:|expire"
# Should show valid Let's Encrypt certificate

# Services
sudo systemctl status ai-server ollama nginx spot-monitor
# All should be "active (running)"
```

### 6.4 Spot Re-launch User Data

Save this as the EC2 launch template user data. It runs on every new spot instance boot:

```bash
#!/bin/bash
VOLUME_ID="vol-XXXXXXXXX"  # Replace with your EBS volume ID
DEVICE="/dev/xvdf"
MOUNT="/opt/ai-server"
REGION="us-west-2"

# Wait for instance metadata
sleep 10
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

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
```

---

## 7. Raspberry Pi Setup

### 7.1 Hardware Assembly

**Freenove Computer Case Kit:**
1. Mount the Pi 5 board into the case base
2. Connect the OLED ribbon cable to the expansion board
3. Attach the fan cables to the expansion board headers
4. Install the NVMe SSD into the M.2 slot on the Freenove PCIe adapter
5. Close the case and secure screws

**Camera Module 3:**
- Insert the FPC cable into **CAM/DISP 0** (closest to USB-C power port)
- Contacts face the PCB on both the Pi and the camera module

**Touchscreen:**
- Insert the display FPC cable into **CAM/DISP 1** (closest to HDMI ports)
- Contacts face the PCB on both ends

**Audio:**
- Plug USB microphone into any USB-A port
- Connect speakers to the 3.5mm audio jack

**Power:**
- Connect the 27W USB-C power supply last

### 7.2 OS Flash and First Boot

1. Download **Raspberry Pi OS (64-bit)** from https://www.raspberrypi.com/software/
2. Flash to microSD card using **Raspberry Pi Imager**
   - In the imager settings, pre-configure:
     - Hostname: `bmo`
     - Username/password: `patrick` / (your password)
     - WiFi SSID and password
     - Enable SSH (password auth for initial setup)
     - Set locale/timezone: America/Denver
3. Insert microSD, connect ethernet (recommended for setup), power on
4. Find the Pi's IP: check your router's DHCP leases or use `ping bmo.local`
5. SSH in: `ssh patrick@<PI_IP>`

### 7.3 Running pi-setup.sh

Copy and run the setup script:

```bash
# From your Windows PC
scp BMO-setup/pi-setup.sh patrick@<PI_IP>:~/

# SSH into Pi
ssh patrick@<PI_IP>

# Run setup (takes ~45 min)
chmod +x ~/pi-setup.sh
./pi-setup.sh
```

**Expected output per phase:**

| Phase | What Happens | Duration |
|-------|-------------|----------|
| Phase 1 | System update, hardware interfaces, apt packages | 10 min |
| Phase 1b | PCIe/NVMe config, EEPROM update | 1 min |
| Phase 2 | Ollama install, pull llama3.2:3b | 10 min |
| Phase 3 | Python venv, pip packages, download Whisper/Piper/YOLO models | 15 min |
| Phase 4 | Freenove repos, expansion board config, OLED service | 3 min |
| Phase 5 | BMO systemd service, Node.js, PeerJS, cloudflared, Nginx, GitHub CLI | 5 min |
| Phase 6 | Chromium kiosk autostart, cursor hiding, screen blanking | 1 min |

**Important**: Reboot after setup completes (required for PCIe/EEPROM changes):

```bash
sudo reboot
```

### 7.4 Post-Setup Verification

After reboot, SSH back in and verify:

```bash
# Hardware
libcamera-hello --timeout 3000          # Camera
speaker-test -t wav -c 2 -l 1          # Speakers
arecord -d 3 /tmp/test.wav && aplay /tmp/test.wav  # Mic
lsblk | grep nvme                       # NVMe SSD
sudo i2cdetect -y 1                     # I2C devices (OLED at 0x3C, expansion at 0x24)

# Services (all should be active/running)
sudo systemctl status bmo peerjs cloudflared oled-stats ollama nginx

# Network
hostname -I                              # Should show IP
curl http://localhost:5000               # Flask app
curl http://localhost:9000/peerjs        # PeerJS

# Ollama
ollama list                              # Should show llama3.2:3b
ollama run bmo "Say hello!"             # Quick LLM test

# New feature directories
ls -la ~/bmo/data/commands/ ~/bmo/data/memory/ ~/bmo/.bmo/hooks/ ~/bmo/.bmo/commands/
```

---

## 8. Cloudflare Setup

### 8.1 Tunnel

SSH into the Pi and create the tunnel:

```bash
# Authenticate (opens a browser URL)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create bmo
# Note the Tunnel ID (UUID) from the output

# Create DNS routes
cloudflared tunnel route dns bmo bmo.yourdomain.com
cloudflared tunnel route dns bmo signaling.yourdomain.com
```

Create the tunnel config file `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/patrick/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: bmo.yourdomain.com
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  - hostname: signaling.yourdomain.com
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  - service: http_status:404
```

Test and start:

```bash
# Test manually
cloudflared tunnel run
# Should show "Connection established connIndex=0 ..."

# Start as service (already created by pi-setup.sh)
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

Verify in the Cloudflare dashboard: **Zero Trust** > **Networks** > **Tunnels** — should show as **Healthy**.

### 8.2 DNS Records

Verify these records exist in your Cloudflare DNS settings:

| Subdomain | Type | Target | Proxy Status | Purpose |
|-----------|------|--------|--------------|---------|
| `bmo` | CNAME | `<TUNNEL_ID>.cfargotunnel.com` | Proxied (orange) | BMO web UI + API |
| `signaling` | CNAME | `<TUNNEL_ID>.cfargotunnel.com` | Proxied (orange) | PeerJS signaling |
| `ai` | A | `<EC2_ELASTIC_IP>` | DNS only (gray) | GPU AI server |
| `assets` | CNAME | (auto-created by R2) | Proxied | Game assets CDN |

> **Important**: Use "DNS only" (gray cloud) for `ai.*`. Cloudflare's proxy has a 100MB upload limit on free tier and adds latency to streaming LLM responses.

### 8.3 R2 Bucket

1. Go to **R2 Object Storage** > **Create bucket**
2. Name: `bmo-assets`, Location: North America
3. **Settings** > **Public access** > **Connect Domain**: `assets.yourdomain.com`
4. Create API token: **R2** > **Manage R2 API Tokens** > **Create API token**
   - Permissions: Object Read & Write
   - Specify bucket: `bmo-assets`
   - Save the Access Key ID and Secret

Upload assets:

```bash
# Map images
aws s3 cp ./maps/ s3://bmo-assets/maps/ --recursive \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# Voice reference clips
aws s3 cp ./voices/ s3://bmo-assets/voices/ --recursive \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

CORS policy (if needed for browser access):

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

### 8.4 Calls TURN (WebRTC Relay)

1. Go to **Calls** in the Cloudflare dashboard > **Get Started**
2. Create a TURN app: name `dnd-vtt-turn`
3. Note the **App ID** and **Token**

Generate TURN credentials (24hr TTL):

```bash
curl -X POST "https://rtc.live.cloudflare.com/v1/turn/keys/<APP_ID>/credentials/generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 86400}'
```

Pass the `iceServers` config to PeerJS in the VTT app:

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

Rotate credentials every 12 hours via cron or on each VTT session start.

### 8.5 SSL/TLS

**Cloudflare settings** (for Pi services via Tunnel):

| Setting | Value |
|---------|-------|
| SSL/TLS Mode | Full |
| Always Use HTTPS | On |
| Automatic HTTPS Rewrites | On |
| Minimum TLS Version | 1.2 |
| TLS 1.3 | Enabled |
| HSTS | Recommended for production |

**EC2 GPU server**: Uses Let's Encrypt via Certbot (configured by `aws-setup.sh`). Verify:

```bash
# Check certificate
curl -vI https://ai.yourdomain.com/health 2>&1 | grep -E "subject:|expire"

# Verify auto-renewal
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## 9. Deployment

### 9.1 First Deploy from Windows (deploy.sh)

From your Windows PC in Git Bash:

```bash
cd /path/to/BMO-setup

# Deploy to Pi
bash deploy.sh <PI_IP> patrick
```

This copies:
- 22 Python service files
- `agents/` directory (33 modules)
- Templates + static assets (HTML, CSS, JS, images)
- Config files (Google Calendar OAuth)
- Modelfile for Ollama

After deploy, SSH into the Pi:

```bash
ssh patrick@<PI_IP>
source ~/bmo/venv/bin/activate
pip install -r ~/bmo/requirements.txt
pip install mcp httpx sseclient-py rich
ollama create bmo -f ~/bmo/Modelfile
sudo systemctl restart bmo
```

### 9.2 On-Pi Deploy (deploy-pi.sh)

If you want to run deployment directly on the Pi (e.g., after cloning the repo there):

```bash
# Copy files to Pi (any method: git clone, scp, USB)
# Then run:
chmod +x deploy-pi.sh
./deploy-pi.sh
```

This handles system packages, Ollama, BMO model creation, Python venv, pip install, and systemd service creation — all in one script.

### 9.3 GPU Server Deploy

```bash
# Copy app files to EC2
scp BMO-setup/AWS/ai_server.py BMO-setup/AWS/requirements.txt \
    ubuntu@<ELASTIC_IP>:/opt/ai-server/app/

# Copy Modelfile
scp BMO-setup/AWS/Modelfile ubuntu@<ELASTIC_IP>:/opt/ai-server/app/

# SSH in and restart
ssh ubuntu@<ELASTIC_IP>
sudo -s
source /opt/ai-server/venv/bin/activate
pip install -r /opt/ai-server/app/requirements.txt
ollama create bmo -f /opt/ai-server/app/Modelfile
systemctl restart ai-server
```

### 9.4 Full-Stack Verification Checklist

Run through this after initial deployment or any major change:

```
Pi Services:
  [ ] curl http://localhost:5000         — Flask app responds
  [ ] curl http://localhost:9000/peerjs  — PeerJS responds
  [ ] ollama run bmo "test"              — Local LLM works
  [ ] systemctl status bmo peerjs cloudflared oled-stats ollama nginx — all active

GPU Server:
  [ ] nvidia-smi                         — GPU detected, driver OK
  [ ] ollama list                        — Models loaded
  [ ] curl http://localhost:8000/health  — AI server responds
  [ ] curl https://ai.yourdomain.com/health — TLS working

Cloudflare:
  [ ] curl https://bmo.yourdomain.com    — Tunnel to Pi works
  [ ] curl https://signaling.yourdomain.com/peerjs — PeerJS via tunnel
  [ ] R2 bucket accessible via assets.yourdomain.com

End-to-End:
  [ ] From Pi: curl -H "Authorization: Bearer <KEY>" https://ai.yourdomain.com/health
  [ ] Wake word triggers voice pipeline
  [ ] TTS produces audio through speakers
  [ ] Camera captures frames (libcamera-hello)
  [ ] OLED shows system stats or BMO face
  [ ] LEDs respond to mood changes
```

---

## 10. Configuration Reference

### 10.1 settings.json Full Schema

The main settings file lives at `~/bmo/data/settings.json`. All keys are optional — defaults are used for missing values.

```json
{
  "llm": {
    "gpu_server_url": "https://ai.yourdomain.com",
    "gpu_server_key": "<api-key>",
    "gpu_server_timeout": 10,
    "gpu_health_check_interval": 30,
    "local_model": "bmo",
    "gpu_model": "bmo",
    "ollama_options": {
      "num_ctx": 8192,
      "num_predict": 1024,
      "temperature": 0.8
    },
    "ollama_plan_options": {
      "num_ctx": 4096,
      "num_predict": 256,
      "temperature": 0.5
    }
  },
  "tools": {
    "allow": [],
    "deny": [],
    "custom_destructive_patterns": [],
    "trusted_directories": [],
    "auto_approve_destructive": false,
    "max_tool_calls_per_turn": 10,
    "max_output_length": 8000,
    "command_timeout": 30
  },
  "agents": {},
  "router": {
    "custom_prefixes": {},
    "custom_keywords": {},
    "disable_tiers": [],
    "default_agent": "conversation"
  },
  "plan_mode": {
    "max_plan_steps": 20,
    "auto_approve_plans": false
  },
  "speaker": {
    "default_name": "gavin",
    "voice_enabled": true,
    "tts_speed": 1.0
  },
  "services": {
    "voice_enabled": true,
    "camera_enabled": true,
    "music_enabled": true,
    "smart_home_enabled": true,
    "calendar_enabled": true,
    "weather_enabled": true,
    "timers_enabled": true,
    "device_name": "BMO",
    "maps_api_key": "",
    "ssh_key_path": "~/.ssh/id_ed25519",
    "aws_host": "ai.yourdomain.com",
    "pc_host": ""
  },
  "mcp": {
    "servers": {},
    "agent_tools": {},
    "readonly_tools": [
      "mcp__*__list*", "mcp__*__get*",
      "mcp__*__read*", "mcp__*__search*"
    ],
    "output_max_tokens": 25000
  },
  "hooks": {
    "preToolUse": [],
    "postToolUse": []
  },
  "memory": {
    "enabled": true,
    "max_lines_loaded": 200
  },
  "ui": {
    "max_history": 200,
    "color_enabled": true,
    "auto_compact_threshold": 150,
    "compact_preserve_last": 5
  }
}
```

> **Pi vs Desktop defaults**: On Pi (aarch64), `ollama_options.num_ctx` defaults to 8192 and `num_predict` to 1024 to fit in 8GB RAM. On desktop, these default to 32768 and 2048.

### 10.2 MCP Server Configuration

MCP (Model Context Protocol) servers provide external tools to BMO agents. Configure in `settings.json` under `mcp.servers`:

**Stdio transport** (local process):

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/patrick"],
        "lazy": false
      }
    }
  }
}
```

**HTTP/SSE transport** (remote server):

```json
{
  "mcp": {
    "servers": {
      "github": {
        "transport": "sse",
        "url": "http://localhost:3001/sse",
        "lazy": true
      }
    }
  }
}
```

**Per-agent tool assignment** (restrict which agents see which MCP tools):

```json
{
  "mcp": {
    "agent_tools": {
      "code": ["mcp__github__*"],
      "smart_home": ["mcp__hass__*"]
    }
  }
}
```

All MCP tools are namespaced as `mcp__<servername>__<toolname>` to avoid collisions.

### 10.3 Hooks Configuration

Hooks run shell commands before or after tool execution. Configure in `settings.json`:

```json
{
  "hooks": {
    "preToolUse": [
      {
        "matcher": "write_file",
        "command": "python3 ~/bmo/.bmo/hooks/lint-check.py"
      },
      {
        "matcher": "mcp__github__*",
        "command": "echo 'GitHub tool used' >> /tmp/bmo-audit.log"
      }
    ],
    "postToolUse": [
      {
        "matcher": "*",
        "command": "python3 ~/bmo/.bmo/hooks/post-audit.py"
      }
    ]
  }
}
```

**Matcher patterns:**
- Exact match: `"write_file"` matches only `write_file`
- Glob: `"mcp__github__*"` matches all GitHub MCP tools
- Wildcard: `"*"` matches everything

**Pre-hooks:**
- Receive tool call JSON on stdin
- Non-zero exit code **blocks** the tool execution
- JSON on stdout can **modify** tool arguments

**Post-hooks:**
- Receive tool result JSON on stdin
- stdout/stderr captured as additional context

Hook scripts go in `~/bmo/.bmo/hooks/` (project-level) or `~/bmo/data/hooks/` (user-level).

### 10.4 Custom Slash Commands

Create custom `/commands` as markdown files. BMO discovers them from two directories:

| Directory | Scope | Priority |
|-----------|-------|----------|
| `.bmo/commands/` | Project-specific | Higher (overrides user) |
| `~/bmo/data/commands/` | User-global | Lower |

**Example**: Create `~/bmo/data/commands/deploy.md`:

```markdown
Deploy the current project to production.

1. Run all tests first
2. Build the project
3. Deploy to the server

Arguments: $ARGUMENTS
```

Usage: `/deploy staging` — the `$ARGUMENTS` placeholder is replaced with `staging`.

List available commands: `/commands` or call `list_commands()`.

### 10.5 Auto-Memory

BMO automatically persists observations and patterns across sessions.

**How it works:**
- Memory files are stored at `~/bmo/data/memory/<project_hash>/MEMORY.md`
- `<project_hash>` is the first 12 chars of MD5 of the absolute working directory path
- On session start, the memory file is loaded into the system prompt (up to 200 lines)
- BMO can write to memory via LLM tool calls during conversation
- Memory is per-project — different directories get separate memory files

**Manual editing:**

```bash
# Find memory files
ls ~/bmo/data/memory/

# Edit memory for a specific project
nano ~/bmo/data/memory/<hash>/MEMORY.md
```

**Settings:**

```json
{
  "memory": {
    "enabled": true,
    "max_lines_loaded": 200
  }
}
```

### 10.6 Agent Configuration

Override per-agent settings in `settings.json`:

```json
{
  "agents": {
    "code": {
      "enabled": true,
      "temperature": 0.3,
      "max_turns": 5,
      "tools_allow": ["read_file", "write_file", "bash", "mcp__github__*"],
      "tools_deny": ["rm", "sudo"],
      "system_prompt_append": "Always write tests.",
      "can_nest": true
    },
    "music": {
      "enabled": false
    }
  }
}
```

Available agent names: `conversation`, `code`, `research`, `plan`, `music`, `smart_home`, `timer`, `calendar`, `weather`, `learning`, `security`, `design`, `cleanup`, `monitoring`, `deploy`, `review`, `docs`, `dnd_dm`, `test`.

### 10.7 Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `GPU_SERVER_URL` | `https://ai.yourdomain.com` | GPU server base URL |
| `GPU_SERVER_KEY` | (empty) | API key for GPU server |
| `GOOGLE_MAPS_API_KEY` | (empty) | Google Maps/Weather API |
| `AWS_HOST` | `ai.yourdomain.com` | SSH host for AWS server |
| `PC_HOST` | (empty) | SSH host for Windows PC |
| `AI_SERVER_KEY` | (empty) | API key validation on EC2 |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL on EC2 |
| `OLLAMA_MODEL` | `bmo` | Default Ollama model on EC2 |
| `AI_DATA_DIR` | `/opt/ai-server/data` | Data directory on EC2 |

---

## 11. Monitoring & Maintenance

### 11.1 CloudWatch Agent on EC2

Install the CloudWatch agent for custom metrics (GPU utilization, disk, memory):

```bash
# Install agent
sudo apt-get install -y amazon-cloudwatch-agent

# Create config
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null << 'EOF'
{
  "metrics": {
    "namespace": "BMO/GPU",
    "metrics_collected": {
      "disk": {
        "measurement": ["used_percent"],
        "resources": ["/"],
        "metrics_collection_interval": 300
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 300
      }
    },
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}"
    }
  }
}
EOF

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

For GPU metrics, add a cron job that pushes nvidia-smi data:

```bash
# Add to crontab: every 5 minutes
*/5 * * * * /opt/ai-server/push-gpu-metrics.sh
```

`/opt/ai-server/push-gpu-metrics.sh`:

```bash
#!/bin/bash
GPU_UTIL=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits)
GPU_MEM=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits)
GPU_TEMP=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits)

aws cloudwatch put-metric-data --namespace "BMO/GPU" --metric-data \
  "[{\"MetricName\":\"GPUUtilization\",\"Value\":$GPU_UTIL,\"Unit\":\"Percent\"},
    {\"MetricName\":\"GPUMemoryUsed\",\"Value\":$GPU_MEM,\"Unit\":\"Megabytes\"},
    {\"MetricName\":\"GPUTemperature\",\"Value\":$GPU_TEMP,\"Unit\":\"None\"}]"
```

### 11.2 Health Check Monitoring

**Pi side** (`monitoring.py`): Runs as part of the BMO app, checks all services periodically, and reports status to the OLED display and optional Discord webhook.

**GPU server** (`/health` endpoint): Returns JSON with Ollama status, GPU availability, and uptime.

```bash
# Quick health check from anywhere
curl -H "Authorization: Bearer <KEY>" https://ai.yourdomain.com/health

# Expected: {"status": "ok", "ollama": true, "timestamp": ...}
# Degraded: {"status": "degraded", "ollama": false, ...}
```

### 11.3 Log Rotation

**Pi (journald):** Logs are managed by systemd journal with default rotation.

```bash
# Check journal disk usage
journalctl --disk-usage

# Manually vacuum old logs (keep 500MB)
sudo journalctl --vacuum-size=500M
```

**EC2 (logrotate):** Configured by `aws-setup.sh` at `/etc/logrotate.d/ai-server`:

```
/var/log/ai-server/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
}
```

### 11.4 Automated S3 Backups

The `cloud_backup.py` script on the Pi creates daily compressed backups of `~/bmo/data/` and uploads to S3.

**Set up daily cron:**

```bash
crontab -e
# Add:
0 3 * * * /home/patrick/bmo/venv/bin/python /home/patrick/bmo/cloud_backup.py >> /tmp/backup.log 2>&1
```

**S3 lifecycle policy** (transition to Glacier after 30 days, expire after 365 days):

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket bmo-backups-<ACCOUNT_ID> \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "GlacierAfter30Days",
      "Status": "Enabled",
      "Filter": {"Prefix": "daily/"},
      "Transitions": [{"Days": 30, "StorageClass": "GLACIER"}],
      "Expiration": {"Days": 365}
    }]
  }'
```

**Restore a backup:**

```bash
aws s3 cp s3://bmo-backups-<ACCOUNT_ID>/daily/bmo-data-2026-02-24.tar.gz /tmp/
tar xzf /tmp/bmo-data-2026-02-24.tar.gz -C ~/bmo/data/
sudo systemctl restart bmo
```

### 11.5 EBS Snapshots

Weekly snapshots of the GPU server's EBS volume for disaster recovery:

```bash
# Create snapshot
aws ec2 create-snapshot \
  --volume-id <VOLUME_ID> \
  --description "BMO weekly backup $(date +%Y-%m-%d)"

# Set up weekly via cron on your local PC or a Lambda
# Keep 4 weeks of snapshots, delete older ones

# List snapshots
aws ec2 describe-snapshots --owner-ids self \
  --query "Snapshots[*].[SnapshotId,StartTime,Description]" \
  --output table

# Delete old snapshot
aws ec2 delete-snapshot --snapshot-id <SNAPSHOT_ID>
```

### 11.6 Update Procedures

**OS updates (Pi):**

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot  # if kernel was updated
```

**OS updates (EC2):**

```bash
sudo apt update && sudo apt upgrade -y
# Avoid kernel updates on GPU instances (can break NVIDIA driver)
# If kernel updated, reinstall NVIDIA driver after reboot
```

**BMO code updates:**

```bash
# From Windows PC
bash deploy.sh <PI_IP> patrick
# Then on Pi:
sudo systemctl restart bmo
```

**Python packages:**

```bash
source ~/bmo/venv/bin/activate
pip install --upgrade -r ~/bmo/requirements.txt
```

**Ollama:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl restart ollama
```

**Ollama models:**

```bash
ollama pull llama3.2:3b          # Pi
ollama pull llama3.1:70b-instruct-q4_K_M  # EC2
ollama create bmo -f ~/bmo/Modelfile       # Recreate custom model
```

**cloudflared:**

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb
sudo systemctl restart cloudflared
```

### 11.7 Discord Alerts (Optional)

Set up a Discord webhook for uptime and spot termination alerts:

```bash
# Create SNS topic
aws sns create-topic --name bmo-alerts

# Subscribe Discord webhook (requires a Lambda or SNS-to-Discord bridge)
# Simple approach: use a Lambda function that forwards SNS to Discord

# Or use the Pi's monitoring.py directly:
# Set DISCORD_WEBHOOK_URL in settings.json
```

In `~/bmo/data/settings.json`:

```json
{
  "services": {
    "discord_webhook_url": "https://discord.com/api/webhooks/..."
  }
}
```

---

## 12. Troubleshooting

### 12.1 GPU Server Unreachable

**Symptoms**: Agent logs `[agent] GPU server unreachable -- using local fallback`. All AI responses come from local Gemma3:4b (slower, lower quality).

```bash
# Check health endpoint
curl -H "Authorization: Bearer <API_KEY>" https://ai.yourdomain.com/health

# Check EC2 instance status
aws ec2 describe-instances --filters "Name=tag:Name,Values=bmo-ai-server" \
  --query "Reservations[].Instances[].{State:State.Name,Id:InstanceId}" --output table

# If running, SSH in and check services
ssh ubuntu@<ELASTIC_IP>
sudo systemctl status ai-server ollama nginx
sudo journalctl -u ai-server --since "1 hour ago"

# Restart if needed
sudo systemctl restart ollama && sleep 10 && sudo systemctl restart ai-server
```

### 12.2 Local Fallback Quality Issues

**Expected**: Gemma3:4b (4B params) will produce shorter, less coherent responses than Llama 3.1 70B. Piper TTS sounds generic vs Fish Speech voice clone.

```bash
# Verify correct model
ollama list

# Check Piper model exists
ls ~/bmo/models/piper/en_US-hfc_female-medium.onnx

# Check sox for pitch shift
which sox || sudo apt install sox
```

### 12.3 Cloudflare Tunnel Not Connecting

```bash
# Check service
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f

# Common fixes:
# "failed to connect to edge" → check internet: ping 1.1.1.1
# "tunnel credentials not found" → ls ~/.cloudflared/*.json
# "502 Bad Gateway" → check nginx: sudo systemctl status nginx
# "no ingress rules match" → verify config.yml has catch-all rule

# Re-add DNS routes
cloudflared tunnel route dns bmo bmo.yourdomain.com
cloudflared tunnel route dns bmo signaling.yourdomain.com
```

### 12.4 PeerJS Signaling Failures

```bash
# Check PeerJS server
sudo systemctl status peerjs
curl http://localhost:9000/peerjs
curl https://signaling.yourdomain.com/peerjs

# Restart
sudo systemctl restart peerjs

# Check Node.js
node --version  # Should be v20.x
which peerjs

# If missing: sudo npm install -g peer
```

### 12.5 Audio Issues

```bash
# Test speakers
speaker-test -t wav -c 2

# Test microphone
arecord -d 5 test.wav && aplay test.wav

# List devices
aplay -l  # Playback
arecord -l  # Recording

# Set output to headphone jack
sudo raspi-config nonint do_audio 1

# Check wake word
sudo journalctl -u bmo | grep "\[wake\]"
```

### 12.6 Camera Not Found

```bash
# Test camera
libcamera-hello --timeout 5000
libcamera-hello --list-cameras

# If not detected: check FPC cable
# Camera → CAM/DISP 0 (closest to USB-C)
# Display → CAM/DISP 1 (closest to HDMI)

# Enable camera interface
sudo raspi-config nonint do_camera 0
sudo reboot
```

### 12.7 Ollama Model Issues

```bash
# List models
ollama list

# Re-create BMO model
ollama create bmo -f ~/bmo/Modelfile

# Out of memory on Pi
sudo journalctl -u ollama | grep -i "memory\|oom"
# Fix: reduce num_ctx in settings.json or use smaller model

# GPU server CUDA issues
nvidia-smi
source /etc/profile.d/cuda.sh
sudo systemctl restart ollama
```

### 12.8 Fish Speech Voice Quality

```bash
# Check reference audio files exist on GPU server
ls -la /opt/ai-server/data/voices/bmo/
ls -la /opt/ai-server/data/voices/npc/

# Test TTS endpoint
curl -X POST https://ai.yourdomain.com/tts \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I am BMO!", "speaker": "bmo_calm"}' \
  --output /tmp/test_tts.wav
aplay /tmp/test_tts.wav

# Reference audio requirements:
# WAV, 16-bit, mono/stereo, 5-15s clean speech, no background noise
```

### 12.9 OLED Display Not Working

```bash
# Scan I2C bus
sudo i2cdetect -y 1
# OLED at 0x3C, expansion board at 0x24

# Enable I2C if needed
sudo raspi-config nonint do_i2c 0
sudo reboot

# Check service
sudo systemctl status oled-stats
sudo journalctl -u oled-stats -f
```

### 12.10 LED Controller Issues

```bash
# Check expansion board
sudo i2cdetect -y 1  # Should show 0x24

# Test manually
python3 -c "
import sys; sys.path.insert(0, '$HOME/Freenove_Computer_Case_Kit_for_Raspberry_Pi/Code')
from expansion import Expansion
board = Expansion()
board.set_led_mode(4)  # Rainbow
print(f'Temp: {board.get_temp()}C')
board.end()
"
```

### 12.11 MCP Server Connection Issues

```bash
# Check if npx is available (needed for stdio MCP servers)
npx --version

# Test MCP server manually
npx -y @modelcontextprotocol/server-filesystem /tmp

# Check BMO logs for MCP errors
sudo journalctl -u bmo | grep -i "mcp"

# Verify settings.json mcp.servers config
python3 -c "import json; print(json.dumps(json.load(open('$HOME/bmo/data/settings.json')).get('mcp',{}), indent=2))"
```

### 12.12 Hooks Not Executing

```bash
# Check hook scripts are executable
ls -la ~/bmo/.bmo/hooks/
chmod +x ~/bmo/.bmo/hooks/*.py

# Test hook script manually
echo '{"tool":"write_file","args":{}}' | python3 ~/bmo/.bmo/hooks/lint-check.py

# Check BMO logs for hook errors
sudo journalctl -u bmo | grep -i "hook"

# Verify hooks config in settings.json
python3 -c "import json; print(json.dumps(json.load(open('$HOME/bmo/data/settings.json')).get('hooks',{}), indent=2))"
```

### 12.13 Custom Commands Not Found

```bash
# List command directories
ls ~/bmo/data/commands/    # User-global
ls ~/bmo/.bmo/commands/    # Project-local (if in a project dir)

# Commands must be .md files
# Example: ~/bmo/data/commands/deploy.md

# Verify discovery
python3 -c "
from agents.custom_commands import list_commands
for cmd in list_commands(): print(cmd)
"
```

### 12.14 General Diagnostic Commands

**Pi system health:**

```bash
vcgencmd measure_temp                    # CPU temp
vcgencmd get_throttled                   # 0x0 = no throttling
free -h                                  # Memory
df -h                                    # Disk
hostname -I                              # IP addresses
sudo systemctl status bmo peerjs cloudflared oled-stats ollama nginx
```

**GPU server health:**

```bash
nvidia-smi                               # GPU status
sudo systemctl status ai-server ollama nginx spot-monitor
curl http://localhost:8000/health
curl http://localhost:8000/gpu/status
ollama list
```

**Full service restart (Pi):**

```bash
sudo systemctl restart ollama && sleep 5
sudo systemctl restart bmo peerjs cloudflared oled-stats nginx
```

**Full service restart (EC2):**

```bash
sudo systemctl restart ollama && sleep 10
sudo systemctl restart ai-server spot-monitor nginx
```

---

## 13. Security Hardening Checklist

### 13.1 Pi Hardening

- [ ] SSH key-only auth (password auth disabled in sshd_config)
- [ ] fail2ban installed and active: `sudo apt install fail2ban && sudo systemctl enable fail2ban`
- [ ] UFW firewall: allow port 80 (Nginx) and 22 (SSH) from LAN only
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow from 192.168.1.0/24 to any port 22
  sudo ufw allow 80/tcp
  sudo ufw enable
  ```
- [ ] Automatic security updates: `sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`
- [ ] Config directory permissions: `chmod 700 ~/bmo/config/`
- [ ] No credentials committed to git (check with `git log --all --diff-filter=A -- '*.json' '*.pem' '*.key'`)
- [ ] `.bmo/` directories have restricted permissions: `chmod 700 ~/bmo/.bmo/`

### 13.2 EC2 Hardening

- [ ] Security group: SSH restricted to home IP only (not 0.0.0.0/0)
- [ ] TLS certificate valid and auto-renewing: `sudo certbot renew --dry-run`
- [ ] API key required on all endpoints (AI_SERVER_KEY set in systemd env)
- [ ] No root SSH: `PermitRootLogin no` in `/etc/ssh/sshd_config`
- [ ] Automatic security updates:
  ```bash
  sudo apt install unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```
- [ ] Log rotation configured: `ls /etc/logrotate.d/ai-server`
- [ ] EBS volume encrypted (enable at launch template level)

### 13.3 Network Hardening

- [ ] Cloudflare proxy enabled on Pi services (orange cloud on bmo.* and signaling.*)
- [ ] No open ports on home router (Cloudflare Tunnel eliminates port forwarding)
- [ ] TURN credentials rotate every 24 hours (TTL in credential generation)
- [ ] TLS 1.2+ minimum (Cloudflare SSL/TLS settings)
- [ ] ai.* uses DNS-only mode (gray cloud) — direct TLS via Let's Encrypt, no proxy overhead
- [ ] HSTS enabled in Cloudflare edge settings

### 13.4 Secrets Management

- [ ] GPU API key generated with `openssl rand -hex 32` (not a weak password)
- [ ] AWS access keys stored only in `~/.aws/credentials` on Pi (not in code)
- [ ] Google OAuth credentials in `~/bmo/config/` with `chmod 600`
- [ ] SSH private keys have `chmod 600` permissions
- [ ] Cloudflare tunnel credentials in `~/.cloudflared/` with restricted access
- [ ] No secrets in environment variables visible via `/proc` (use systemd `EnvironmentFile` instead)

### 13.5 Disaster Recovery

| Metric | Value |
|--------|-------|
| **RPO** (Recovery Point Objective) | 24 hours — daily S3 backups + weekly EBS snapshots |
| **RTO** (Recovery Time Objective) | ~1 hour — spot relaunch + EBS reattach |
| **Full rebuild** | ~3 hours — follow this guide from scratch |

**Recovery procedures:**

| Scenario | Recovery Steps |
|----------|---------------|
| Spot instance terminated | Persistent spot request auto-relaunches. User data script reattaches EBS. Services restart automatically. |
| EBS volume lost | Restore from latest EBS snapshot. Update volume ID in user data script. |
| Pi SD card failure | Re-flash OS, run `pi-setup.sh`, restore data from S3 backup. |
| Pi hardware failure | Replace Pi, run setup from scratch (~2 hours), restore from S3. |
| All data lost | Follow this guide end-to-end (~3 hours). Only loss: conversation history between last backup and failure. |

**Monthly backup verification:**

```bash
# Test S3 backup restore
aws s3 cp s3://bmo-backups-<ID>/daily/bmo-data-$(date +%Y-%m-%d).tar.gz /tmp/test-restore.tar.gz
tar tzf /tmp/test-restore.tar.gz | head -20  # Verify contents
rm /tmp/test-restore.tar.gz

# Create Pi SD card image backup
sudo dd if=/dev/mmcblk0 bs=4M status=progress | gzip > ~/pi-backup-$(date +%Y-%m-%d).img.gz
```
