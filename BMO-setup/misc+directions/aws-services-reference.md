# AWS + Cloudflare Services Reference

> Quick-reference card for all cloud services used in BMO + VTT infrastructure.
> Region: **us-east-1** for all AWS services.

---

## Cost Summary

| Service | Monthly Estimate |
|---------|-----------------|
| EC2 g5.xlarge Spot | ~$216 |
| EBS 100GB gp3 | ~$8 |
| S3 (backups + sync) | ~$2 |
| Route 53 | ~$1 |
| CloudWatch | Free tier |
| Elastic IP | Free (while attached) |
| IAM / VPC / SG | Free |
| Cloudflare (all) | Free tier |
| **Total** | **~$227/mo** |

---

## 1. EC2 -- Spot Instance (AI Server)

| Property | Value |
|----------|-------|
| Instance type | g5.xlarge |
| GPU | 1x NVIDIA A10G, 24GB VRAM |
| CPU / RAM | 4 vCPU / 16GB |
| AMI | Ubuntu 24.04 LTS |
| Spot price | ~$0.30/hr (~$216/mo) |
| EBS root | 100GB gp3 (persist on termination) |
| Security group | 443 inbound (HTTPS), 22 inbound (home IP) |
| Key pair | SSH key for access |
| Spot type | Persistent request, auto-relaunch |

**Console:** `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:`

### CLI Commands

```bash
# Check spot instance status
aws ec2 describe-spot-instance-requests \
  --filters "Name=state,Values=active,open" \
  --query "SpotInstanceRequests[*].{ID:InstanceId,State:State,Status:Status.Code,Price:SpotPrice}" \
  --output table

# Get instance public IP
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" "Name=instance-type,Values=g5.xlarge" \
  --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]" \
  --output table

# SSH into the instance
ssh -i ~/.ssh/your-key.pem ubuntu@<ELASTIC_IP>

# Check GPU on remote
ssh -i ~/.ssh/your-key.pem ubuntu@<ELASTIC_IP> "nvidia-smi"

# Restart AI services on remote
ssh -i ~/.ssh/your-key.pem ubuntu@<ELASTIC_IP> "sudo systemctl restart ai-server"

# Cancel spot request (does NOT terminate instance)
aws ec2 cancel-spot-instance-requests --spot-instance-request-ids <SIR_ID>

# Terminate the instance
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>

# Request new spot instance
aws ec2 request-spot-instances \
  --spot-price "0.40" \
  --instance-count 1 \
  --type "persistent" \
  --launch-specification file://spot-spec.json
```

### Spot Interruption Handling

When AWS reclaims the spot instance:
1. 2-minute warning via instance metadata
2. EBS volume persists (configured `DeleteOnTermination: false`)
3. Persistent spot request auto-launches a new instance
4. User data script re-attaches EBS and restarts services

```bash
# Check for interruption notice (run on instance)
curl -s http://169.254.169.254/latest/meta-data/spot/instance-action 2>/dev/null || echo "No interruption"
```

---

## 2. S3 -- Backups + VTT Cloud Sync

| Property | Value |
|----------|-------|
| Backup bucket | `bmo-backups-<account-id>` |
| VTT sync bucket | `vtt-cloud-sync-<account-id>` |
| Storage class | S3 Standard (active data) |
| Lifecycle | Transition to Glacier after 30 days |
| Estimated cost | ~$2/mo |

**Console:** `https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1`

### Bucket Structure

```
bmo-backups-<account-id>/
  daily/
    bmo-data-2026-02-24.tar.gz
    bmo-data-2026-02-23.tar.gz
    ...

vtt-cloud-sync-<account-id>/
  characters/
    <user-id>/<character-id>.json
  campaigns/
    <campaign-id>.json
```

### CLI Commands

```bash
# List recent backups
aws s3 ls s3://bmo-backups-<account-id>/daily/ --human-readable | tail -10

# Download latest backup
aws s3 cp s3://bmo-backups-<account-id>/daily/bmo-data-$(date +%Y-%m-%d).tar.gz ./restore/

# Upload a manual backup
tar czf bmo-data-manual.tar.gz ~/bmo/data/
aws s3 cp bmo-data-manual.tar.gz s3://bmo-backups-<account-id>/manual/

# Check total bucket size
aws s3 ls s3://bmo-backups-<account-id> --recursive --summarize | tail -2

# Restore a backup
aws s3 cp s3://bmo-backups-<account-id>/daily/bmo-data-2026-02-24.tar.gz /tmp/
tar xzf /tmp/bmo-data-2026-02-24.tar.gz -C ~/bmo/data/

# Sync VTT character data
aws s3 sync ./characters/ s3://vtt-cloud-sync-<account-id>/characters/

# Set lifecycle policy (Glacier after 30 days)
aws s3api put-bucket-lifecycle-configuration \
  --bucket bmo-backups-<account-id> \
  --lifecycle-configuration file://lifecycle.json
```

### Lifecycle Policy (`lifecycle.json`)

```json
{
  "Rules": [
    {
      "ID": "GlacierAfter30Days",
      "Status": "Enabled",
      "Filter": { "Prefix": "daily/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 }
    }
  ]
}
```

---

## 3. Route 53 -- DNS

| Property | Value |
|----------|-------|
| Domain | `yourdomain.com` (placeholder) |
| Hosted zone cost | $0.50/mo |
| Query cost | $0.40/million queries |

**Console:** `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones`

### DNS Records

| Record | Type | Value | Notes |
|--------|------|-------|-------|
| `ai.yourdomain.com` | A | `<Elastic IP>` | EC2 AI server (direct) |
| `bmo.yourdomain.com` | CNAME | `<tunnel-id>.cfargotunnel.com` | Cloudflare Tunnel to Pi |
| `signaling.yourdomain.com` | CNAME | `<tunnel-id>.cfargotunnel.com` | Cloudflare Tunnel to Pi |

Use **Alias records** for AWS resources (free, no query charges). Use CNAME for Cloudflare Tunnel endpoints.

### CLI Commands

```bash
# List hosted zones
aws route53 list-hosted-zones --query "HostedZones[*].[Name,Id]" --output table

# List records in zone
aws route53 list-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --query "ResourceRecordSets[*].[Name,Type,TTL,ResourceRecords[0].Value]" \
  --output table

# Update a record (upsert)
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch file://dns-change.json
```

### Record Change Template (`dns-change.json`)

```json
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "ai.yourdomain.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "<ELASTIC_IP>" }]
      }
    }
  ]
}
```

---

## 4. CloudWatch -- Monitoring + Alerts

| Property | Value |
|----------|-------|
| EC2 metrics | CPU, network, disk (built-in) |
| Custom metrics | Memory, GPU util, disk % (via agent) |
| Alarms | Spot interruption, service health, disk full |
| Log groups | `/ai-server`, `/spot-monitor` |
| SNS targets | Discord webhook, Pi OLED face |
| Cost | Mostly free tier |

**Console:** `https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1`

### CLI Commands

```bash
# List alarms
aws cloudwatch describe-alarms \
  --query "MetricAlarms[*].[AlarmName,StateValue,MetricName]" \
  --output table

# Get CPU utilization (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=<INSTANCE_ID> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --output table

# Create a disk-full alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "disk-usage-critical" \
  --metric-name "disk_used_percent" \
  --namespace "CWAgent" \
  --statistic Average \
  --period 300 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions <SNS_TOPIC_ARN>

# View recent logs
aws logs tail /ai-server --since 1h --follow

# Create SNS topic for alerts
aws sns create-topic --name bmo-alerts

# Subscribe Discord webhook to SNS (via Lambda or direct HTTPS)
aws sns subscribe \
  --topic-arn <SNS_TOPIC_ARN> \
  --protocol https \
  --notification-endpoint <DISCORD_WEBHOOK_URL>
```

### Alert Flow

```
CloudWatch Alarm
  --> SNS Topic (bmo-alerts)
    --> Discord webhook (team notifications)
    --> Pi OLED face (BMO expression change)
```

---

## 5. IAM -- Access Control

| Principal | Purpose | Permissions |
|-----------|---------|-------------|
| EC2 instance role (`bmo-ec2-role`) | S3 access from AI server | `s3:GetObject`, `s3:PutObject` on backup + sync buckets |
| IAM user (`bmo-pi-user`) | Pi's boto3 for S3 uploads | `s3:PutObject` on backup bucket, `ec2:DescribeSpotInstanceRequests`, `ec2:DescribeInstances` |

**Console:** `https://us-east-1.console.aws.amazon.com/iam/home`

### EC2 Instance Role Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::bmo-backups-*",
        "arn:aws:s3:::bmo-backups-*/*",
        "arn:aws:s3:::vtt-cloud-sync-*",
        "arn:aws:s3:::vtt-cloud-sync-*/*"
      ]
    }
  ]
}
```

### Pi IAM User Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::bmo-backups-*",
        "arn:aws:s3:::bmo-backups-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ec2:DescribeSpotInstanceRequests", "ec2:DescribeInstances"],
      "Resource": "*"
    }
  ]
}
```

### CLI Commands

```bash
# List roles
aws iam list-roles --query "Roles[?starts_with(RoleName,'bmo')].[RoleName,Arn]" --output table

# List users
aws iam list-users --query "Users[?starts_with(UserName,'bmo')].[UserName,CreateDate]" --output table

# Create access key for Pi user
aws iam create-access-key --user-name bmo-pi-user

# Attach policy to EC2 role
aws iam attach-role-policy \
  --role-name bmo-ec2-role \
  --policy-arn <POLICY_ARN>
```

---

## 6. EBS -- Persistent Storage

| Property | Value |
|----------|-------|
| Volume type | gp3 |
| Size | 100GB |
| IOPS / throughput | 3000 / 125 MB/s (gp3 baseline) |
| Delete on termination | **No** (persists after spot termination) |
| Snapshot schedule | Weekly |
| Cost | ~$8/mo |

**Console:** `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Volumes:`

### CLI Commands

```bash
# List volumes
aws ec2 describe-volumes \
  --query "Volumes[*].[VolumeId,Size,State,Attachments[0].InstanceId]" \
  --output table

# Create snapshot
aws ec2 create-snapshot \
  --volume-id <VOLUME_ID> \
  --description "BMO weekly backup $(date +%Y-%m-%d)"

# List snapshots
aws ec2 describe-snapshots \
  --owner-ids self \
  --query "Snapshots[*].[SnapshotId,VolumeId,StartTime,VolumeSize]" \
  --output table

# Attach volume to new instance (after spot relaunch)
aws ec2 attach-volume \
  --volume-id <VOLUME_ID> \
  --instance-id <INSTANCE_ID> \
  --device /dev/xvdf

# Check volume on instance
ssh -i ~/.ssh/your-key.pem ubuntu@<IP> "lsblk && df -h"
```

### User Data Script (Auto-Reattach on Spot Relaunch)

```bash
#!/bin/bash
VOLUME_ID="vol-xxxxxxxxxxxxxxxxx"
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
aws ec2 attach-volume --volume-id $VOLUME_ID --instance-id $INSTANCE_ID --device /dev/xvdf
sleep 10
mount /dev/xvdf /mnt/data
systemctl restart ai-server
```

---

## 7. Elastic IP (Optional)

| Property | Value |
|----------|-------|
| Cost (attached) | Free |
| Cost (unattached) | $0.005/hr (~$3.60/mo) |
| Use case | Static IP for `ai.yourdomain.com` A record |

**Console:** `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Addresses:`

### CLI Commands

```bash
# Allocate new Elastic IP
aws ec2 allocate-address --domain vpc

# Associate with instance
aws ec2 associate-address \
  --instance-id <INSTANCE_ID> \
  --allocation-id <ALLOCATION_ID>

# Disassociate
aws ec2 disassociate-address --association-id <ASSOCIATION_ID>

# Release (stop charges)
aws ec2 release-address --allocation-id <ALLOCATION_ID>

# List Elastic IPs
aws ec2 describe-addresses --query "Addresses[*].[PublicIp,InstanceId,AllocationId]" --output table
```

---

## 8. VPC / Security Groups

| Property | Value |
|----------|-------|
| VPC | Default VPC |
| Security group | `bmo-ai-server-sg` |
| Cost | Free |

**Console:** `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#SecurityGroups:`

### Security Group Rules

| Direction | Port | Protocol | Source | Purpose |
|-----------|------|----------|--------|---------|
| Inbound | 443 | TCP | 0.0.0.0/0 | HTTPS (AI API) |
| Inbound | 22 | TCP | `<HOME_IP>/32` | SSH (restricted) |
| Outbound | All | All | 0.0.0.0/0 | Default allow-all |

### CLI Commands

```bash
# List security groups
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=bmo-*" \
  --query "SecurityGroups[*].[GroupId,GroupName]" \
  --output table

# View rules
aws ec2 describe-security-group-rules \
  --filter "Name=group-id,Values=<SG_ID>" \
  --query "SecurityGroupRules[*].[IsEgress,IpProtocol,FromPort,ToPort,CidrIpv4,Description]" \
  --output table

# Add SSH rule (update with current home IP)
aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp \
  --port 22 \
  --cidr "$(curl -s ifconfig.me)/32"

# Remove old SSH rule
aws ec2 revoke-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp \
  --port 22 \
  --cidr "<OLD_IP>/32"
```

---

## Cloudflare Services (Free Tier)

All Cloudflare services run on the free plan. No AWS costs.

**Dashboard:** `https://dash.cloudflare.com`

### Tunnel -- Expose Pi Services

Securely exposes Pi-hosted services without port forwarding or public IP.

| Property | Value |
|----------|-------|
| Tunnel name | `bmo-tunnel` |
| Runs on | Raspberry Pi |
| Exposes | BMO web UI, signaling server |
| Routes | `bmo.yourdomain.com`, `signaling.yourdomain.com` |
| Cost | Free |

```bash
# Install cloudflared on Pi
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create bmo-tunnel

# Run tunnel (or configure as systemd service)
cloudflared tunnel run bmo-tunnel

# Check tunnel status
cloudflared tunnel info bmo-tunnel

# List tunnels
cloudflared tunnel list
```

### R2 -- Object Storage (Map Images + Game Data CDN)

| Property | Value |
|----------|-------|
| Use case | Map images, game data, static assets |
| Egress | Free (zero egress fees) |
| Storage | 10GB free, then $0.015/GB/mo |
| Custom domain | `cdn.yourdomain.com` |

```bash
# List buckets (via AWS CLI with R2 endpoint)
aws s3 ls --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# Upload map image
aws s3 cp map.webp s3://vtt-assets/maps/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# Sync assets
aws s3 sync ./public/assets/ s3://vtt-assets/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### Calls -- TURN/STUN (WebRTC NAT Traversal)

| Property | Value |
|----------|-------|
| Use case | VTT voice/video and data channel NAT traversal |
| Free tier | 1,000 GB/mo relay traffic |
| Protocols | TURN (TCP/UDP 443), STUN |

Configure in VTT PeerJS/WebRTC ICE servers:

```typescript
const iceServers = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:turn.cloudflare.com:443?transport=tcp',
    username: '<TURN_TOKEN_ID>',
    credential: '<TURN_TOKEN>'
  }
];
```

```bash
# Generate TURN credentials (via Cloudflare API)
curl -X POST "https://rtc.live.cloudflare.com/v1/turn/keys/<APP_ID>/credentials/generate" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 86400}'
```

### CDN -- Edge Caching for R2

| Property | Value |
|----------|-------|
| Use case | Cache R2 assets at edge for low latency |
| Cache rules | Cache everything on `cdn.yourdomain.com` |
| Purge | Via dashboard or API |

```bash
# Purge specific URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"files": ["https://cdn.yourdomain.com/maps/dungeon.webp"]}'

# Purge everything
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}'
```

---

## Quick Reference: All Console URLs

| Service | URL |
|---------|-----|
| EC2 Instances | `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:` |
| EC2 Spot Requests | `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#SpotInstances:` |
| EC2 Volumes (EBS) | `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Volumes:` |
| EC2 Elastic IPs | `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Addresses:` |
| EC2 Security Groups | `https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#SecurityGroups:` |
| S3 Buckets | `https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1` |
| Route 53 | `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones` |
| CloudWatch | `https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1` |
| IAM | `https://us-east-1.console.aws.amazon.com/iam/home` |
| Cloudflare | `https://dash.cloudflare.com` |
