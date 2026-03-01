#!/usr/bin/env bash
# bmo.sh — Single entry point for all BMO deployment operations
#
# Usage: bash bmo.sh <command> [target] [options]
#
#   setup pi              SCP pi-setup.sh to Pi, run it, prompt reboot
#   setup aws [--launch]  Create AWS infra + optional spot launch + auto-deploy
#
#   deploy pi             Deploy BMO to Pi (files, deps, model, restart, health)
#   deploy aws            Deploy AI server + DnD project to EC2
#   deploy all            Deploy to both
#
#   auth                  Run interactive auth on Pi via SSH -t
#                         (Cloudflare tunnel, Google Calendar, hardware check)
#
#   cleanup pi [--force]  Remove BMO from Pi
#   cleanup aws [--force] Remove BMO + AWS resources
#   cleanup all [--force] Remove both
#
#   status                Health check both Pi + AWS

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
load_env "$SCRIPT_DIR/.env"

COMMAND="${1:-}"
TARGET="${2:-}"
shift 2 2>/dev/null || true

# Parse remaining flags
LAUNCH_INSTANCE=false
FORCE=false
for arg in "$@"; do
    case "$arg" in
        --launch) LAUNCH_INSTANCE=true ;;
        --force)  FORCE=true ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════
# Helper: update_env — write a key=value to .env
# ═══════════════════════════════════════════════════════════════════════
ENV_FILE="$SCRIPT_DIR/.env"

update_env() {
    local key="$1" val="$2"
    if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
        sed -i "s|^${key}=.*|${key}=\"${val}\"|" "$ENV_FILE"
    else
        echo "${key}=\"${val}\"" >> "$ENV_FILE"
    fi
}

# ═══════════════════════════════════════════════════════════════════════
# setup pi — SCP pi-setup.sh + .env to Pi, run it, prompt reboot
# ═══════════════════════════════════════════════════════════════════════
cmd_setup_pi() {
    require_env "PI_IP" "PI_USER"
    preflight_check "ssh" "scp"

    local PI_DEST="${PI_USER}@${PI_IP}"
    SSH_OPTS=""

    echo "═══════════════════════════════════════════════════════"
    echo "  BMO Pi Setup — ${PI_DEST}"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    log "[1/3] Copying setup files to Pi..."
    retry_scp "$SCRIPT_DIR/pi-setup.sh" "${PI_DEST}:~/"
    [ -f "$ENV_FILE" ] && retry_scp "$ENV_FILE" "${PI_DEST}:~/.env"
    log_ok "Files copied"

    log "[2/3] Running pi-setup.sh on Pi (this takes 15-30 minutes)..."
    retry_ssh "$PI_DEST" "chmod +x ~/pi-setup.sh && bash ~/pi-setup.sh"
    log_ok "Pi setup complete"

    log "[3/3] Reboot required for PCIe/EEPROM changes"
    echo ""
    echo "  Next steps:"
    echo "    1. Reboot the Pi:  ssh ${PI_DEST} 'sudo reboot'"
    echo "    2. After reboot:   bash bmo.sh deploy pi"
    echo "    3. Interactive auth: bash bmo.sh auth"
    echo ""
    if confirm "Reboot Pi now?"; then
        ssh $SSH_OPTS "$PI_DEST" "sudo reboot" || true
        log_ok "Reboot command sent"
    fi
}

# ═══════════════════════════════════════════════════════════════════════
# setup aws [--launch] — Create AWS infrastructure
# ═══════════════════════════════════════════════════════════════════════
cmd_setup_aws() {
    preflight_check "aws" "curl" "jq"

    local REGION="${AWS_REGION:-us-east-1}"
    local BUDGET="${MONTHLY_BUDGET:-50}"
    local ALERT_EMAIL="${BUDGET_ALERT_EMAIL:-}"
    local KEY_NAME="${AWS_KEY_NAME:-bmo_ed25519}"
    local SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/${KEY_NAME}.pem}"

    echo "═══════════════════════════════════════════════════════"
    echo "  BMO AWS Infrastructure Setup"
    echo "  Region: $REGION"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    # ── 1. Get AWS Account ID + Check Spot Pricing ───────────────────
    log "[1/9] Getting AWS account info..."
    local ACCOUNT_ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
    log "  Account: $ACCOUNT_ID"

    local SPOT_PRICE
    SPOT_PRICE=$(aws ec2 describe-spot-price-history \
        --instance-types g5.xlarge \
        --product-descriptions "Linux/UNIX" \
        --start-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
        --max-items 1 \
        --query "SpotPriceHistory[0].SpotPrice" --output text \
        --region "$REGION" 2>/dev/null) || SPOT_PRICE="unknown"
    log "  g5.xlarge spot price: \$$SPOT_PRICE/hr in $REGION"

    # ── 1b. SSH Key Pair ─────────────────────────────────────────────
    log "[1b/9] Setting up SSH key pair..."
    if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
        mkdir -p "$HOME/.ssh"
        aws ec2 create-key-pair \
            --key-name "$KEY_NAME" \
            --key-type ed25519 \
            --region "$REGION" \
            --query "KeyMaterial" --output text > "$SSH_KEY"
        chmod 600 "$SSH_KEY"
        log_ok "Created key pair: $KEY_NAME -> $SSH_KEY"
    else
        log "  Key pair already exists: $KEY_NAME"
        check_ssh_key "$SSH_KEY" || log_warn "Local key file missing at $SSH_KEY -- download from AWS console"
    fi

    # ── 2. Security Group ────────────────────────────────────────────
    log "[2/9] Setting up security group..."
    local SG_ID
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=bmo-ai-server-sg" \
        --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null) || true

    if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
        SG_ID=$(aws ec2 create-security-group \
            --group-name bmo-ai-server-sg \
            --description "BMO AI GPU Server" \
            --region "$REGION" \
            --query "GroupId" --output text)

        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 \
            --region "$REGION"
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 \
            --region "$REGION"

        local MY_IP
        MY_IP=$(curl -s ifconfig.me)
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" --protocol tcp --port 22 --cidr "${MY_IP}/32" \
            --region "$REGION"

        log_ok "Created security group: $SG_ID (SSH from $MY_IP)"
    else
        log "  Security group already exists: $SG_ID"
    fi

    # ── 3. IAM Role for EC2 ──────────────────────────────────────────
    log "[3/9] Setting up IAM role..."
    if ! aws iam get-role --role-name bmo-ec2-role &>/dev/null; then
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
            --policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": [
                        "cloudwatch:PutMetricData",
                        "ec2:DescribeVolumes",
                        "ec2:AttachVolume",
                        "ec2:DescribeInstances"
                    ],
                    "Resource": "*"
                }]
            }'

        aws iam create-instance-profile --instance-profile-name bmo-ec2-role 2>/dev/null || true
        aws iam add-role-to-instance-profile \
            --instance-profile-name bmo-ec2-role \
            --role-name bmo-ec2-role 2>/dev/null || true

        log_ok "Created IAM role: bmo-ec2-role"
    else
        log "  IAM role already exists: bmo-ec2-role"
    fi

    # ── 4. IAM User for Pi ───────────────────────────────────────────
    log "[4/9] Setting up IAM user for Pi..."
    if ! aws iam get-user --user-name bmo-pi-user &>/dev/null; then
        aws iam create-user --user-name bmo-pi-user

        aws iam put-user-policy --user-name bmo-pi-user \
            --policy-name bmo-pi-policy \
            --policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                    "Resource": ["arn:aws:s3:::bmo-backups-*", "arn:aws:s3:::bmo-backups-*/*"]
                }]
            }'

        log_ok "Created IAM user: bmo-pi-user"
        log "  Generating access key..."
        aws iam create-access-key --user-name bmo-pi-user \
            --query "AccessKey.[AccessKeyId, SecretAccessKey]" --output text
        echo "  ^^^ SAVE THESE CREDENTIALS -- they won't be shown again"
    else
        log "  IAM user already exists: bmo-pi-user"
    fi

    # ── 5. Elastic IP ────────────────────────────────────────────────
    log "[5/9] Setting up Elastic IP..."
    local EIP EXISTING_EIP
    EXISTING_EIP=$(aws ec2 describe-addresses \
        --filters "Name=tag:Name,Values=bmo-ai-server" \
        --query "Addresses[0].PublicIp" --output text --region "$REGION" 2>/dev/null) || true

    if [ "$EXISTING_EIP" = "None" ] || [ -z "$EXISTING_EIP" ]; then
        local ALLOC_RESULT ALLOC_ID
        ALLOC_RESULT=$(aws ec2 allocate-address --domain vpc --region "$REGION" \
            --query "[AllocationId, PublicIp]" --output text)
        ALLOC_ID=$(echo "$ALLOC_RESULT" | awk '{print $1}')
        EIP=$(echo "$ALLOC_RESULT" | awk '{print $2}')

        aws ec2 create-tags --resources "$ALLOC_ID" \
            --tags Key=Name,Value=bmo-ai-server --region "$REGION"

        log_ok "Allocated Elastic IP: $EIP (AllocationId: $ALLOC_ID)"
    else
        EIP="$EXISTING_EIP"
        log "  Elastic IP already exists: $EIP"
    fi

    # ── 6. EBS Volume ────────────────────────────────────────────────
    log "[6/9] Setting up EBS volume..."
    local VOL_ID EXISTING_VOL
    EXISTING_VOL=$(aws ec2 describe-volumes \
        --filters "Name=tag:Name,Values=bmo-ai-data" "Name=status,Values=available,in-use" \
        --query "Volumes[0].VolumeId" --output text --region "$REGION" 2>/dev/null) || true

    if [ "$EXISTING_VOL" = "None" ] || [ -z "$EXISTING_VOL" ]; then
        local AZ
        AZ=$(aws ec2 describe-availability-zones --region "$REGION" \
            --query "AvailabilityZones[0].ZoneName" --output text)

        VOL_ID=$(aws ec2 create-volume \
            --availability-zone "$AZ" \
            --size 100 --volume-type gp3 \
            --tag-specifications "ResourceType=volume,Tags=[{Key=Name,Value=bmo-ai-data}]" \
            --region "$REGION" \
            --query "VolumeId" --output text)

        log_ok "Created EBS volume: $VOL_ID (100GB gp3 in $AZ)"
    else
        VOL_ID="$EXISTING_VOL"
        log "  EBS volume already exists: $VOL_ID"
    fi

    # ── 7. Budget Alerts ─────────────────────────────────────────────
    log "[7/9] Setting up budget alerts..."
    if ! aws budgets describe-budget --account-id "$ACCOUNT_ID" --budget-name bmo-monthly &>/dev/null; then
        local TOPIC_ARN
        TOPIC_ARN=$(aws sns create-topic --name bmo-budget-alerts --region "$REGION" \
            --query "TopicArn" --output text)

        if [ -n "$ALERT_EMAIL" ]; then
            aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email \
                --notification-endpoint "$ALERT_EMAIL" --region "$REGION" > /dev/null
            log "  Subscribed $ALERT_EMAIL to budget alerts (check inbox to confirm)"
        fi

        aws budgets create-budget --account-id "$ACCOUNT_ID" \
            --budget "{
                \"BudgetName\": \"bmo-monthly\",
                \"BudgetLimit\": {\"Amount\": \"$BUDGET\", \"Unit\": \"USD\"},
                \"TimeUnit\": \"MONTHLY\",
                \"BudgetType\": \"COST\"
            }" \
            --notifications-with-subscribers "[
                {
                    \"Notification\": {
                        \"NotificationType\": \"ACTUAL\",
                        \"ComparisonOperator\": \"GREATER_THAN\",
                        \"Threshold\": 80,
                        \"ThresholdType\": \"PERCENTAGE\"
                    },
                    \"Subscribers\": [{\"SubscriptionType\": \"SNS\", \"Address\": \"$TOPIC_ARN\"}]
                },
                {
                    \"Notification\": {
                        \"NotificationType\": \"ACTUAL\",
                        \"ComparisonOperator\": \"GREATER_THAN\",
                        \"Threshold\": 100,
                        \"ThresholdType\": \"PERCENTAGE\"
                    },
                    \"Subscribers\": [{\"SubscriptionType\": \"SNS\", \"Address\": \"$TOPIC_ARN\"}]
                }
            ]"

        log_ok "Created budget: \$$BUDGET/month with alerts at 80% and 100%"
    else
        log "  Budget already exists: bmo-monthly"
    fi

    # ── 8. Launch Template ───────────────────────────────────────────
    log "[8/9] Setting up launch template..."
    if ! aws ec2 describe-launch-templates --launch-template-names bmo-gpu-server --region "$REGION" &>/dev/null; then
        local AMI_ID
        AMI_ID=$(aws ec2 describe-images --owners 099720109477 \
            --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
            --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" --output text \
            --region "$REGION")

        aws ec2 create-launch-template \
            --launch-template-name bmo-gpu-server \
            --region "$REGION" \
            --launch-template-data "{
                \"ImageId\": \"$AMI_ID\",
                \"InstanceType\": \"g5.xlarge\",
                \"KeyName\": \"$KEY_NAME\",
                \"SecurityGroupIds\": [\"$SG_ID\"],
                \"IamInstanceProfile\": {\"Name\": \"bmo-ec2-role\"},
                \"BlockDeviceMappings\": [{
                    \"DeviceName\": \"/dev/sda1\",
                    \"Ebs\": {
                        \"VolumeSize\": 100,
                        \"VolumeType\": \"gp3\",
                        \"DeleteOnTermination\": false
                    }
                }],
                \"TagSpecifications\": [{
                    \"ResourceType\": \"instance\",
                    \"Tags\": [{\"Key\": \"Name\", \"Value\": \"bmo-ai-server\"}]
                }]
            }"

        log_ok "Created launch template: bmo-gpu-server (AMI: $AMI_ID)"
    else
        log "  Launch template already exists: bmo-gpu-server"
    fi

    # ── Update .env with discovered values ───────────────────────────
    log ""
    log "Updating .env with infrastructure values..."
    update_env "EC2_IP" "$EIP"
    update_env "EBS_VOLUME_ID" "$VOL_ID"
    update_env "AWS_SECURITY_GROUP" "$SG_ID"
    update_env "AWS_ACCOUNT_ID" "$ACCOUNT_ID"
    update_env "SSH_KEY_PATH" "$SSH_KEY"

    # ── 9. Launch Spot Instance (optional) ───────────────────────────
    if [ "$LAUNCH_INSTANCE" = true ]; then
        log "[9/9] Launching spot instance..."

        local INSTANCE_ID EXISTING
        EXISTING=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=bmo-ai-server" "Name=instance-state-name,Values=running,pending" \
            --query "Reservations[0].Instances[0].InstanceId" --output text \
            --region "$REGION" 2>/dev/null) || true

        if [ -n "$EXISTING" ] && [ "$EXISTING" != "None" ]; then
            log "  Instance already running: $EXISTING"
            INSTANCE_ID="$EXISTING"
        else
            local USER_DATA
            USER_DATA=$(cat << USERDATA_EOF | base64 -w0
#!/bin/bash
VOLUME_ID="$VOL_ID"
DEVICE="/dev/xvdf"
MOUNT="/opt/ai-server"
REGION="$REGION"

sleep 10
INSTANCE_ID=\$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

if ! lsblk | grep -q xvdf; then
    aws ec2 attach-volume --volume-id "\$VOLUME_ID" --instance-id "\$INSTANCE_ID" \
        --device "\$DEVICE" --region "\$REGION"
    for i in {1..30}; do
        if lsblk | grep -q xvdf; then break; fi
        sleep 5
    done
fi

if ! mountpoint -q "\$MOUNT"; then
    mkdir -p "\$MOUNT"
    mount "\$DEVICE" "\$MOUNT"
fi

systemctl restart ollama
sleep 10
systemctl restart ai-server
systemctl restart spot-monitor
USERDATA_EOF
)

            INSTANCE_ID=$(aws ec2 run-instances \
                --launch-template "LaunchTemplateName=bmo-gpu-server" \
                --instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time","InstanceInterruptionBehavior":"terminate"}}' \
                --user-data "$USER_DATA" \
                --region "$REGION" \
                --query "Instances[0].InstanceId" --output text)

            log_ok "Spot instance launched: $INSTANCE_ID"

            log "  Waiting for instance to start..."
            aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
            log_ok "Instance running"
        fi

        # Associate Elastic IP
        local ALLOC_ID
        ALLOC_ID=$(aws ec2 describe-addresses \
            --filters "Name=tag:Name,Values=bmo-ai-server" \
            --query "Addresses[0].AllocationId" --output text --region "$REGION")

        aws ec2 associate-address \
            --instance-id "$INSTANCE_ID" \
            --allocation-id "$ALLOC_ID" \
            --region "$REGION" > /dev/null

        log_ok "Elastic IP $EIP associated with $INSTANCE_ID"

        # Wait for SSH then auto-chain to deploy
        SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -i $SSH_KEY"
        wait_for_host "ubuntu@$EIP" 180

        log ""
        log "Auto-chaining to deploy aws..."
        cmd_deploy_aws
    else
        log "[9/9] Skipping instance launch (use --launch to auto-launch)"
    fi

    log ""
    echo "═══════════════════════════════════════════════════════"
    echo "  AWS Infrastructure Ready!"
    echo ""
    echo "  SSH Key:         $SSH_KEY"
    echo "  Security Group:  $SG_ID"
    echo "  IAM Role:        bmo-ec2-role"
    echo "  IAM User:        bmo-pi-user"
    echo "  Elastic IP:      $EIP"
    echo "  EBS Volume:      $VOL_ID"
    echo "  Spot Price:      \$$SPOT_PRICE/hr"
    echo "  Budget:          \$$BUDGET/month"
    echo "  Launch Template: bmo-gpu-server"
    echo ""
    echo "  Values saved to: $ENV_FILE"
    echo "  Log saved to:    $LOG_FILE"
    echo ""
    if [ "$LAUNCH_INSTANCE" = true ]; then
        echo "  Instance is running and deployed!"
    else
        echo "  To launch + deploy in one go:"
        echo "    bash bmo.sh setup aws --launch"
    fi
    echo "═══════════════════════════════════════════════════════"
}

# ═══════════════════════════════════════════════════════════════════════
# deploy pi — Deploy BMO files to Raspberry Pi
# ═══════════════════════════════════════════════════════════════════════
cmd_deploy_pi() {
    local PI_IP="${PI_IP:-}"
    local PI_USER="${PI_USER:-patrick}"
    [ -z "$PI_IP" ] && { log_err "PI_IP not set -- add to .env"; exit 1; }
    preflight_check "ssh" "scp"

    local PI_DEST="${PI_USER}@${PI_IP}"
    SSH_OPTS=""
    local MODELFILE_PATH="pi/Modelfile"

    echo "═══════════════════════════════════════════════════════"
    echo "  Deploying BMO to ${PI_DEST}"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    # ── 0. Wait for Pi ───────────────────────────────────────────────
    wait_for_host "$PI_DEST" 60

    # ── 1. Create directories ────────────────────────────────────────
    log "[1/8] Creating directories..."
    retry_ssh "$PI_DEST" "mkdir -p ~/bmo/{config,models/piper,data/{commands,memory,dnd_sessions},templates,static/{css,js,img},.bmo/{hooks,commands},.audiocache,static/thumbcache}"

    # ── 2. Copy Python files ─────────────────────────────────────────
    log "[2/8] Copying Python services..."
    retry_scp pi/app.py pi/agent.py pi/cli.py pi/dev_tools.py \
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
    retry_scp pi/requirements.txt "${PI_DEST}:~/bmo/"
    log_ok "22 Python files + requirements.txt"

    # ── 3. Copy agents directory ─────────────────────────────────────
    log "[3/8] Copying agents directory..."
    retry_scp -r pi/agents/ "${PI_DEST}:~/bmo/agents/"
    log_ok "Agents directory"

    # ── 4. Templates + static assets ─────────────────────────────────
    log "[4/8] Copying templates + static assets..."
    retry_scp pi/templates/index.html "${PI_DEST}:~/bmo/templates/"
    retry_scp pi/static/css/bmo.css "${PI_DEST}:~/bmo/static/css/"
    retry_scp pi/static/js/*.js "${PI_DEST}:~/bmo/static/js/"
    scp pi/static/img/*.png "${PI_DEST}:~/bmo/static/img/" 2>/dev/null || log_warn "No images found"
    log_ok "Templates + static"

    # ── 5. Config + certs ────────────────────────────────────────────
    log "[5/8] Copying config files..."
    scp pi/tv_cert.pem pi/tv_key.pem "${PI_DEST}:~/bmo/" 2>/dev/null || log_warn "No TV certs (pair via TV tab later)"
    scp config/credentials.json "${PI_DEST}:~/bmo/config/" 2>/dev/null || log_warn "No credentials.json (run bmo.sh auth)"
    scp config/token.json "${PI_DEST}:~/bmo/config/" 2>/dev/null || log_warn "No token.json (run bmo.sh auth)"

    if [ -f "$MODELFILE_PATH" ]; then
        retry_scp "$MODELFILE_PATH" "${PI_DEST}:~/bmo/Modelfile"
        log_ok "Modelfile copied"
    else
        log_warn "No Modelfile at $MODELFILE_PATH"
    fi

    # Copy post-setup-auth.sh to Pi for interactive auth
    if [ -f "$SCRIPT_DIR/pi/post-setup-auth.sh" ]; then
        retry_scp "$SCRIPT_DIR/pi/post-setup-auth.sh" "${PI_DEST}:~/bmo/"
        log_ok "post-setup-auth.sh copied to ~/bmo/"
    fi

    # ── 6. Install dependencies ──────────────────────────────────────
    log "[6/8] Installing Python dependencies..."
    retry_ssh "$PI_DEST" "source ~/bmo/venv/bin/activate && pip install -r ~/bmo/requirements.txt -q && pip install mcp httpx sseclient-py rich -q" \
        && log_ok "Python deps installed" \
        || log_warn "pip install failed -- run manually on the Pi"

    # ── 7. Create model + restart ────────────────────────────────────
    log "[7/8] Creating Ollama model + restarting BMO..."
    if [ -f "$MODELFILE_PATH" ] || ssh "$PI_DEST" "test -f ~/bmo/Modelfile" 2>/dev/null; then
        retry_ssh "$PI_DEST" "ollama create bmo -f ~/bmo/Modelfile" \
            && log_ok "BMO model created" \
            || log_warn "ollama create failed"
    else
        log_warn "No Modelfile -- skipping model creation"
    fi
    retry_ssh "$PI_DEST" "sudo systemctl restart bmo" \
        && log_ok "BMO service restarted" \
        || log_warn "BMO restart failed"

    # ── 8. Health checks ─────────────────────────────────────────────
    log "[8/8] Running health checks..."
    verify_service "bmo" "$PI_DEST"
    verify_service "ollama" "$PI_DEST"
    check_http "http://${PI_IP}:5000" "BMO Web UI"

    local MODELS
    MODELS=$(ssh "$PI_DEST" "ollama list 2>/dev/null | tail -n +2 | awk '{print \$1}' | tr '\n' ', ' | sed 's/,$//'") || true
    [ -n "$MODELS" ] && log_ok "Ollama models: $MODELS" || log_warn "No Ollama models loaded"

    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  Deploy complete!"
    echo ""
    echo "  Web UI:  http://${PI_IP}:5000"
    echo "  SSH:     ssh ${PI_DEST}"
    echo "  Logs:    ssh ${PI_DEST} 'sudo journalctl -u bmo -f'"
    echo "  Log:     $LOG_FILE"
    echo ""
    echo "  Next: bash bmo.sh auth"
    echo "═══════════════════════════════════════════════════════"
}

# ═══════════════════════════════════════════════════════════════════════
# deploy aws — Deploy AI server + DnD project to EC2
# ═══════════════════════════════════════════════════════════════════════
cmd_deploy_aws() {
    local EC2_IP="${EC2_IP:-}"
    local SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/aws-key.pem}"
    local EC2_USER="${EC2_USER:-ubuntu}"
    [ -z "$EC2_IP" ] && { log_err "EC2_IP not set -- add to .env"; exit 1; }
    preflight_check "ssh" "scp"
    check_ssh_key "$SSH_KEY" || true

    local EC2_DEST="${EC2_USER}@${EC2_IP}"
    local APP_DIR="/opt/ai-server/app"
    local DATA_DIR="/opt/ai-server/data"
    local DND_DIR="/opt/dnd-project"

    SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
    if [ -f "$SSH_KEY" ]; then
        SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
    else
        log_warn "SSH key not found at $SSH_KEY -- using default SSH config"
    fi

    echo "═══════════════════════════════════════════════════════"
    echo "  Deploying BMO AI Server to ${EC2_DEST}"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    # ── 0. Wait for host ─────────────────────────────────────────────
    wait_for_host "$EC2_DEST" 120

    # ── 1. Create directories ────────────────────────────────────────
    log "[1/7] Creating directories..."
    retry_ssh "$EC2_DEST" "sudo mkdir -p $APP_DIR $DATA_DIR/voices/bmo $DATA_DIR/voices/npc $DATA_DIR/rag_data $DND_DIR && sudo chown -R $EC2_USER:$EC2_USER $APP_DIR $DATA_DIR $DND_DIR"

    # ── 2. Upload AI server files ────────────────────────────────────
    log "[2/7] Uploading AI server files..."
    retry_scp AWS/ai_server.py AWS/rag_search.py AWS/requirements.txt "${EC2_DEST}:${APP_DIR}/"
    retry_scp AWS/Modelfile "${EC2_DEST}:${APP_DIR}/"
    log_ok "ai_server.py, rag_search.py, requirements.txt, Modelfile uploaded"

    # ── 3. Upload voice references ───────────────────────────────────
    log "[3/7] Uploading voice references..."
    if [ -n "$(ls -A AWS/bmo_voices/ 2>/dev/null)" ]; then
        retry_scp -r AWS/bmo_voices/* "${EC2_DEST}:${DATA_DIR}/voices/bmo/"
        log_ok "BMO voices uploaded"
    else
        log_warn "AWS/bmo_voices/ is empty -- add voice reference files later"
    fi
    if [ -n "$(ls -A AWS/npc_voices/ 2>/dev/null)" ]; then
        retry_scp -r AWS/npc_voices/* "${EC2_DEST}:${DATA_DIR}/voices/npc/"
        log_ok "NPC voices uploaded"
    else
        log_warn "AWS/npc_voices/ is empty -- add voice reference files later"
    fi

    # ── 4. Upload RAG data ───────────────────────────────────────────
    log "[4/7] Uploading RAG data..."
    if [ -n "$(ls -A AWS/rag_data/ 2>/dev/null)" ]; then
        retry_scp -r AWS/rag_data/* "${EC2_DEST}:${DATA_DIR}/rag_data/"
        log_ok "RAG data uploaded"
    else
        log_warn "AWS/rag_data/ is empty -- add RAG indexes later"
    fi

    # ── 5. Sync DnD project ──────────────────────────────────────────
    log "[5/7] Syncing DnD project (excluding node_modules, .git, dist)..."
    estimate_transfer /c/Users/evilp/dnd
    if command -v rsync &>/dev/null; then
        retry 3 rsync -az --progress \
            --exclude 'node_modules' \
            --exclude '.git' \
            --exclude 'dist' \
            --exclude 'out' \
            --exclude '.claude' \
            -e "ssh $SSH_OPTS" \
            /c/Users/evilp/dnd/ "${EC2_DEST}:${DND_DIR}/"
        log_ok "DnD project synced via rsync"
    else
        log "rsync not available -- using tar+ssh"
        retry_ssh "$EC2_DEST" "rm -rf ${DND_DIR}/src ${DND_DIR}/public" 2>/dev/null || true
        (cd /c/Users/evilp/dnd && tar cf - \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='dist' \
            --exclude='out' \
            --exclude='.claude' \
            . ) | retry 3 ssh $SSH_OPTS "$EC2_DEST" "tar xf - -C ${DND_DIR}/"
        log_ok "DnD project uploaded via tar+ssh"
    fi

    retry_ssh "$EC2_DEST" "test -f ${APP_DIR}/ai_server.py && test -f ${APP_DIR}/Modelfile && test -d ${DND_DIR}/src" \
        && log_ok "Remote files verified" \
        || log_err "Some files missing on remote -- check upload"

    # ── 6. Install deps + create model ───────────────────────────────
    log "[6/7] Installing Python deps + creating BMO model..."
    retry_ssh "$EC2_DEST" "source /opt/ai-server/venv/bin/activate && pip install -r ${APP_DIR}/requirements.txt -q" \
        && log_ok "Python deps installed" \
        || log_warn "pip install failed -- check logs"
    retry_ssh "$EC2_DEST" "ollama create bmo -f ${APP_DIR}/Modelfile" \
        && log_ok "BMO model created" \
        || log_warn "ollama create failed -- check Ollama is running"
    retry_ssh "$EC2_DEST" "sudo systemctl restart ai-server" \
        && log_ok "ai-server restarted" \
        || log_warn "ai-server restart failed"

    # ── 7. Health checks ─────────────────────────────────────────────
    log "[7/7] Running health checks..."
    verify_service "ollama" "$EC2_DEST"
    verify_service "ai-server" "$EC2_DEST"

    local MODELS
    MODELS=$(ssh $SSH_OPTS "$EC2_DEST" "ollama list 2>/dev/null | tail -n +2 | awk '{print \$1}' | tr '\n' ', ' | sed 's/,$//'") || true
    if [ -n "$MODELS" ]; then
        log_ok "Ollama models: $MODELS"
    else
        log_warn "No Ollama models loaded yet (may still be pulling)"
    fi

    retry_ssh "$EC2_DEST" "df -h /opt/ai-server | tail -1 | awk '{print \"Disk: \" \$4 \" free of \" \$2}'" || true

    # ── Auto-configure SSH config for VS Code Remote-SSH ─────────────
    local SSH_CONFIG="$HOME/.ssh/config"
    if [ -f "$SSH_CONFIG" ] && grep -q "^Host aws-dev" "$SSH_CONFIG"; then
        sed -i "/^Host aws-dev/,/^Host /{s|HostName .*|HostName ${EC2_IP}|}" "$SSH_CONFIG"
        log "Updated aws-dev in ~/.ssh/config"
    else
        mkdir -p "$HOME/.ssh"
        cat >> "$SSH_CONFIG" << SSHEOF

Host aws-dev
    HostName ${EC2_IP}
    User ${EC2_USER}
    IdentityFile ${SSH_KEY}
SSHEOF
        chmod 600 "$SSH_CONFIG"
        log_ok "Added aws-dev to ~/.ssh/config"
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  AWS deployment complete!"
    echo ""
    echo "  AI Server:  https://${EC2_IP}"
    echo "  SSH:        ssh aws-dev"
    echo "  Log:        $LOG_FILE"
    echo ""
    echo "  VS Code Remote-SSH:"
    echo "    Ctrl+Shift+P -> 'Remote-SSH: Connect to Host' -> aws-dev"
    echo "    Then open folder: /opt/dnd-project"
    echo "═══════════════════════════════════════════════════════"
}

# ═══════════════════════════════════════════════════════════════════════
# auth — SCP post-setup-auth.sh to Pi, ssh -t to run interactively
# ═══════════════════════════════════════════════════════════════════════
cmd_auth() {
    local PI_IP="${PI_IP:-}"
    local PI_USER="${PI_USER:-patrick}"
    [ -z "$PI_IP" ] && { log_err "PI_IP not set -- add to .env"; exit 1; }
    preflight_check "ssh" "scp"

    local PI_DEST="${PI_USER}@${PI_IP}"
    SSH_OPTS=""

    echo "═══════════════════════════════════════════════════════"
    echo "  BMO Interactive Auth — ${PI_DEST}"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    log "Copying post-setup-auth.sh to Pi..."
    retry_scp "$SCRIPT_DIR/pi/post-setup-auth.sh" "${PI_DEST}:~/bmo/"
    log_ok "Script copied"

    log "Starting interactive auth session (ssh -t)..."
    echo "  (This opens an interactive SSH session on the Pi)"
    echo ""
    ssh -t $SSH_OPTS "$PI_DEST" "bash ~/bmo/post-setup-auth.sh"
}

# ═══════════════════════════════════════════════════════════════════════
# cleanup pi [--force] — Remove BMO from Pi
# ═══════════════════════════════════════════════════════════════════════
cmd_cleanup_pi() {
    echo "═══════════════════════════════════════════════════════"
    echo "  Cleaning up BMO on Raspberry Pi"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    local RUN_CMD
    if [ -f "/etc/systemd/system/bmo.service" ]; then
        RUN_CMD="bash -c"
        log "Running locally on Pi"
    else
        local PI_IP="${PI_IP:-}"
        local PI_USER="${PI_USER:-patrick}"
        [ -z "$PI_IP" ] && { log_err "Not on Pi and PI_IP not set"; exit 1; }
        SSH_OPTS=""
        RUN_CMD="ssh ${PI_USER}@${PI_IP}"
        log "Cleaning Pi remotely: ${PI_USER}@${PI_IP}"
    fi

    if confirm "Stop BMO services (bmo, peerjs, oled-stats)?"; then
        $RUN_CMD "sudo systemctl stop bmo peerjs oled-stats 2>/dev/null; sudo systemctl disable bmo peerjs oled-stats 2>/dev/null" || true
        log_ok "Services stopped"
    fi

    if confirm "Remove BMO systemd service files?"; then
        $RUN_CMD "sudo rm -f /etc/systemd/system/bmo.service /etc/systemd/system/peerjs.service /etc/systemd/system/oled-stats.service; sudo systemctl daemon-reload" || true
        log_ok "Service files removed"
    fi

    if confirm "Remove ~/bmo/ directory (ALL data, venv, configs)?"; then
        $RUN_CMD "rm -rf ~/bmo" || true
        log_ok "~/bmo/ removed"
    fi

    $RUN_CMD "rm -f ~/oled-stats.py" 2>/dev/null || true

    if confirm "Remove BMO Ollama model (keeps Ollama installed)?"; then
        $RUN_CMD "ollama rm bmo 2>/dev/null" || true
        log_ok "BMO model removed"
    fi

    if confirm "Remove BMO nginx config?"; then
        $RUN_CMD "sudo rm -f /etc/nginx/sites-enabled/bmo /etc/nginx/sites-available/bmo; sudo systemctl reload nginx 2>/dev/null" || true
        log_ok "Nginx config removed"
    fi

    if confirm "Remove Cloudflare tunnel config?"; then
        $RUN_CMD "sudo systemctl stop cloudflared 2>/dev/null; sudo systemctl disable cloudflared 2>/dev/null; rm -rf ~/.cloudflared" || true
        log_ok "Cloudflare tunnel config removed"
    fi

    echo ""
    log_ok "Pi cleanup complete"
    echo "  Note: Ollama, Node.js, system packages were kept installed."
    echo "  To fully uninstall: sudo apt remove ollama nodejs"
}

# ═══════════════════════════════════════════════════════════════════════
# cleanup aws [--force] — Remove BMO from AWS
# ═══════════════════════════════════════════════════════════════════════
cmd_cleanup_aws() {
    echo "═══════════════════════════════════════════════════════"
    echo "  Cleaning up BMO on AWS"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    local EC2_IP="${EC2_IP:-}"
    local SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/aws-key.pem}"
    local EC2_USER="${EC2_USER:-ubuntu}"
    local REGION="${AWS_REGION:-us-east-1}"

    # Remote cleanup (if instance is running)
    if [ -n "$EC2_IP" ]; then
        SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
        [ -f "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

        if ssh $SSH_OPTS -o ConnectTimeout=5 "${EC2_USER}@${EC2_IP}" "echo ok" &>/dev/null; then
            if confirm "Stop AI server services on EC2?"; then
                ssh $SSH_OPTS "${EC2_USER}@${EC2_IP}" "sudo systemctl stop ai-server spot-monitor 2>/dev/null" || true
                log_ok "EC2 services stopped"
            fi
            if confirm "Remove AI server app files (keeps data volume)?"; then
                ssh $SSH_OPTS "${EC2_USER}@${EC2_IP}" "sudo rm -rf /opt/ai-server/app/*" || true
                log_ok "App files removed"
            fi
            if confirm "Remove DnD project from EC2?"; then
                ssh $SSH_OPTS "${EC2_USER}@${EC2_IP}" "sudo rm -rf /opt/dnd-project" || true
                log_ok "DnD project removed"
            fi
        else
            log_warn "EC2 instance not reachable at $EC2_IP -- skipping remote cleanup"
        fi
    fi

    # AWS resource cleanup
    if confirm "Remove AWS resources (security group, IAM, launch template)?"; then
        preflight_check "aws"

        local INSTANCE_ID
        INSTANCE_ID=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=bmo-ai-server" "Name=instance-state-name,Values=running,pending,stopping" \
            --query "Reservations[0].Instances[0].InstanceId" --output text \
            --region "$REGION" 2>/dev/null) || true

        if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
            if confirm "Terminate EC2 instance $INSTANCE_ID?"; then
                aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
                log_ok "Instance $INSTANCE_ID terminated"
                aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID" --region "$REGION" 2>/dev/null || true
            fi
        fi

        aws ec2 delete-launch-template --launch-template-name bmo-gpu-server --region "$REGION" 2>/dev/null && log_ok "Launch template deleted" || true

        local SG_ID
        SG_ID=$(aws ec2 describe-security-groups \
            --filters "Name=group-name,Values=bmo-ai-server-sg" \
            --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null) || true
        if [ -n "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
            aws ec2 delete-security-group --group-id "$SG_ID" --region "$REGION" 2>/dev/null && log_ok "Security group deleted" || log_warn "Could not delete SG (may have dependencies)"
        fi

        aws iam delete-role-policy --role-name bmo-ec2-role --policy-name bmo-ec2-policy 2>/dev/null || true
        aws iam remove-role-from-instance-profile --instance-profile-name bmo-ec2-role --role-name bmo-ec2-role 2>/dev/null || true
        aws iam delete-instance-profile --instance-profile-name bmo-ec2-role 2>/dev/null || true
        aws iam delete-role --role-name bmo-ec2-role 2>/dev/null && log_ok "IAM role deleted" || true

        aws iam delete-user-policy --user-name bmo-pi-user --policy-name bmo-pi-policy 2>/dev/null || true
        for key_id in $(aws iam list-access-keys --user-name bmo-pi-user --query "AccessKeyMetadata[].AccessKeyId" --output text 2>/dev/null); do
            aws iam delete-access-key --user-name bmo-pi-user --access-key-id "$key_id" 2>/dev/null || true
        done
        aws iam delete-user --user-name bmo-pi-user 2>/dev/null && log_ok "IAM user deleted" || true

        log_ok "AWS IAM resources cleaned up"
    fi

    echo ""
    echo "  Note: EBS volume and Elastic IP were kept (they contain your data)."
    echo "  To delete manually:"
    echo "    aws ec2 release-address --allocation-id <ALLOC_ID>"
    echo "    aws ec2 delete-volume --volume-id <VOL_ID>"

    if [ -f "$HOME/.ssh/config" ] && grep -q "^Host aws-dev" "$HOME/.ssh/config"; then
        if confirm "Remove aws-dev from ~/.ssh/config?"; then
            sed -i '/^Host aws-dev/,/^Host \|^$/d' "$HOME/.ssh/config"
            log_ok "aws-dev removed from SSH config"
        fi
    fi

    echo ""
    log_ok "AWS cleanup complete"
}

# ═══════════════════════════════════════════════════════════════════════
# status — Health check both Pi + AWS
# ═══════════════════════════════════════════════════════════════════════
cmd_status() {
    echo "═══════════════════════════════════════════════════════"
    echo "  BMO System Status"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    local PI_IP="${PI_IP:-}"
    local PI_USER="${PI_USER:-patrick}"
    local EC2_IP="${EC2_IP:-}"
    local SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/aws-key.pem}"
    local EC2_USER="${EC2_USER:-ubuntu}"

    # ── Pi Status ────────────────────────────────────────────────────
    if [ -n "$PI_IP" ]; then
        echo "  -- Raspberry Pi (${PI_USER}@${PI_IP}) --"
        SSH_OPTS=""
        if ssh $SSH_OPTS -o ConnectTimeout=5 "${PI_USER}@${PI_IP}" "echo ok" &>/dev/null; then
            log_ok "Pi reachable"
            verify_service "bmo" "${PI_USER}@${PI_IP}" || true
            verify_service "ollama" "${PI_USER}@${PI_IP}" || true
            verify_service "peerjs" "${PI_USER}@${PI_IP}" || true
            verify_service "cloudflared" "${PI_USER}@${PI_IP}" || true
            check_http "http://${PI_IP}:5000" "BMO Web UI" || true

            local PI_MODELS
            PI_MODELS=$(ssh $SSH_OPTS "${PI_USER}@${PI_IP}" "ollama list 2>/dev/null | tail -n +2 | awk '{print \$1}' | tr '\n' ', ' | sed 's/,$//'") || true
            [ -n "$PI_MODELS" ] && log_ok "Ollama models: $PI_MODELS" || log_warn "No Ollama models"

            ssh $SSH_OPTS "${PI_USER}@${PI_IP}" "df -h / | tail -1 | awk '{print \"  Disk: \" \$4 \" free of \" \$2}'" || true
            ssh $SSH_OPTS "${PI_USER}@${PI_IP}" "cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{printf \"  CPU Temp: %.1fC\n\", \$1/1000}'" || true
        else
            log_err "Pi not reachable at $PI_IP"
        fi
    else
        log_warn "PI_IP not configured -- skipping Pi status"
    fi

    echo ""

    # ── AWS Status ───────────────────────────────────────────────────
    if [ -n "$EC2_IP" ]; then
        echo "  -- AWS EC2 (${EC2_USER}@${EC2_IP}) --"
        SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
        [ -f "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

        if ssh $SSH_OPTS -o ConnectTimeout=5 "${EC2_USER}@${EC2_IP}" "echo ok" &>/dev/null; then
            log_ok "EC2 reachable"
            verify_service "ollama" "${EC2_USER}@${EC2_IP}" || true
            verify_service "ai-server" "${EC2_USER}@${EC2_IP}" || true
            verify_service "spot-monitor" "${EC2_USER}@${EC2_IP}" || true

            local EC2_MODELS
            EC2_MODELS=$(ssh $SSH_OPTS "${EC2_USER}@${EC2_IP}" "ollama list 2>/dev/null | tail -n +2 | awk '{print \$1}' | tr '\n' ', ' | sed 's/,$//'") || true
            [ -n "$EC2_MODELS" ] && log_ok "Ollama models: $EC2_MODELS" || log_warn "No Ollama models"

            ssh $SSH_OPTS "${EC2_USER}@${EC2_IP}" "df -h /opt/ai-server | tail -1 | awk '{print \"  Disk: \" \$4 \" free of \" \$2}'" 2>/dev/null || true
            ssh $SSH_OPTS "${EC2_USER}@${EC2_IP}" "nvidia-smi --query-gpu=gpu_name,memory.used,memory.total --format=csv,noheader 2>/dev/null | awk '{print \"  GPU: \" \$0}'" || true
        else
            log_err "EC2 not reachable at $EC2_IP"
        fi
    else
        log_warn "EC2_IP not configured -- skipping AWS status"
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════"
    log "Status check complete. Log: $LOG_FILE"
}

# ═══════════════════════════════════════════════════════════════════════
# usage — Help text
# ═══════════════════════════════════════════════════════════════════════
usage() {
    echo "Usage: bash bmo.sh <command> [target] [options]"
    echo ""
    echo "Commands:"
    echo "  setup pi              SCP pi-setup.sh to Pi, run it, prompt reboot"
    echo "  setup aws [--launch]  Create AWS infra + optional spot launch + auto-deploy"
    echo ""
    echo "  deploy pi             Deploy BMO to Pi (files, deps, model, restart, health)"
    echo "  deploy aws            Deploy AI server + DnD project to EC2"
    echo "  deploy all            Deploy to both"
    echo ""
    echo "  auth                  Run interactive auth on Pi via SSH -t"
    echo "                        (Cloudflare tunnel, Google Calendar, hardware check)"
    echo ""
    echo "  cleanup pi [--force]  Remove BMO from Pi"
    echo "  cleanup aws [--force] Remove BMO + AWS resources"
    echo "  cleanup all [--force] Remove both"
    echo ""
    echo "  status                Health check both Pi + AWS"
    echo ""
    echo "Examples:"
    echo "  bash bmo.sh setup aws --launch   # Full AWS setup + launch + deploy"
    echo "  bash bmo.sh deploy all           # Redeploy to Pi and AWS"
    echo "  bash bmo.sh status               # Health check everything"
    echo ""
    echo "Config: Copy .env.template to .env and fill in values first"
}

# ═══════════════════════════════════════════════════════════════════════
# Command dispatch
# ═══════════════════════════════════════════════════════════════════════
case "${COMMAND}" in
    setup)
        case "${TARGET}" in
            pi)  cmd_setup_pi ;;
            aws) cmd_setup_aws ;;
            *)   echo "Usage: bash bmo.sh setup <pi|aws> [--launch]"; exit 1 ;;
        esac
        ;;
    deploy)
        case "${TARGET}" in
            pi)  cmd_deploy_pi ;;
            aws) cmd_deploy_aws ;;
            all) cmd_deploy_pi; echo ""; cmd_deploy_aws ;;
            *)   echo "Usage: bash bmo.sh deploy <pi|aws|all>"; exit 1 ;;
        esac
        ;;
    auth)
        cmd_auth
        ;;
    cleanup)
        case "${TARGET}" in
            pi)  cmd_cleanup_pi ;;
            aws) cmd_cleanup_aws ;;
            all) cmd_cleanup_pi; echo ""; cmd_cleanup_aws ;;
            *)   echo "Usage: bash bmo.sh cleanup <pi|aws|all> [--force]"; exit 1 ;;
        esac
        ;;
    status)
        cmd_status
        ;;
    *)
        usage
        ;;
esac
