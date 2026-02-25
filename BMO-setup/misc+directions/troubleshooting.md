# BMO Troubleshooting Guide

Common issues and fixes for the BMO two-system setup (Raspberry Pi + EC2 GPU server).

---

## 1. GPU Server Unreachable

**Symptoms**: Agent logs `[agent] GPU server unreachable -- using local fallback`. All AI responses come from the local Gemma3:4b model (slower, lower quality). TTS uses Piper instead of Fish Speech.

### Check the health endpoint

```bash
curl -H "Authorization: Bearer <API_KEY>" https://ai.yourdomain.com/health
```

Expected response:
```json
{"status": "ok", "ollama": true, "timestamp": 1234567890}
```

If `"status": "degraded"`, Ollama is down on the GPU server but the Flask app is running.

### EC2 spot instance was terminated

Spot instances get a 2-minute warning before termination. The spot monitor service handles graceful shutdown, but the instance itself is gone.

1. Check the AWS console for instance status:
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Name,Values=ai-server" \
     --query "Reservations[].Instances[].{State:State.Name,Id:InstanceId}"
   ```

2. If terminated, launch a new spot instance from the launch template. The user data script will:
   - Reattach the persistent EBS volume
   - Restart Ollama, AI server, and spot monitor

3. Update the DNS A record for `ai.yourdomain.com` if the new instance has a different IP (use an Elastic IP to avoid this).

### EC2 instance is running but server is down

SSH into the instance and check services:

```bash
sudo systemctl status ai-server
sudo systemctl status ollama
sudo journalctl -u ai-server --since "1 hour ago"
```

Restart if needed:

```bash
sudo systemctl restart ollama
sleep 10  # Wait for Ollama to initialize
sudo systemctl restart ai-server
```

### Check GPU health

```bash
nvidia-smi
```

If nvidia-smi fails or shows errors:
- The NVIDIA driver may have crashed. Reboot the instance.
- Check if the CUDA toolkit is properly installed: `nvcc --version`

### Network / firewall issues

```bash
# On the EC2 instance, check if the server is listening
curl http://localhost:8000/health

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check security group allows inbound 443
aws ec2 describe-security-groups --group-ids <sg-id> \
  --query "SecurityGroups[].IpPermissions[]"
```

### Forced fallback mode

If the GPU server will be down for an extended period, the Pi continues operating normally with local models. The health check cache (30s TTL) means the Pi will stop trying the GPU server quickly and use local Ollama exclusively until the server comes back.

---

## 2. Local Fallback Quality Issues

**Symptoms**: Responses are shorter, less coherent, or slower when the GPU server is down. TTS voice sounds generic instead of BMO.

### LLM quality (Gemma3:4b vs Llama 3.1 70B)

This is expected. The local model has 4B parameters vs 70B on the GPU. Mitigations:

- The local model uses a smaller context window (8K vs 32K) and shorter max output (1024 vs 2048 tokens) to stay within the Pi's 8GB RAM.
- For D&D DM mode, responses will be less detailed. Consider keeping sessions short or waiting for the GPU server to return.
- Check that the correct local model is loaded:
  ```bash
  ollama list
  ```
  You should see `bmo` (based on Gemma3:4b or whichever model was configured).

### TTS quality (Piper vs Fish Speech)

Local Piper TTS uses a generic female voice with pitch shifting. The voice will not sound like BMO.

- Verify Piper model exists:
  ```bash
  ls ~/bmo/models/piper/en_US-hfc_female-medium.onnx
  ```
- Verify sox is installed (needed for pitch shift):
  ```bash
  which sox
  ```
  If missing: `sudo apt install sox`
- If pitch shift sounds wrong, adjust `PITCH_SHIFT` in `voice_pipeline.py` (default: 400 cents = 4 semitones up).

### STT quality (Whisper base vs Large-v3)

Local Whisper base model is less accurate, especially with:
- Background noise
- Non-native English accents
- Quiet speech
- Multiple speakers

Mitigation: speak clearly and close to the microphone when using local fallback.

---

## 3. Cloudflare Tunnel Not Connecting

**Symptoms**: `bmo.yourdomain.com` returns a Cloudflare error page (502, 521, or 1033). The Pi's web UI is not accessible externally.

### Check cloudflared service

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

### Common errors and fixes

**"failed to connect to edge"**:
- Check internet connectivity on the Pi: `ping 1.1.1.1`
- Check DNS resolution: `nslookup cloudflare.com`
- Restart cloudflared: `sudo systemctl restart cloudflared`

**"tunnel credentials not found"**:
- Verify the credentials file exists:
  ```bash
  ls ~/.cloudflared/*.json
  ```
- Verify `config.yml` points to the correct credentials file:
  ```bash
  cat ~/.cloudflared/config.yml
  ```
- If credentials are missing, re-create the tunnel:
  ```bash
  cloudflared tunnel login
  cloudflared tunnel create bmo
  ```
  Then update `config.yml` with the new tunnel ID.

**"no ingress rules match"**:
- Check that `config.yml` has a catch-all rule at the end:
  ```yaml
  ingress:
    - hostname: bmo.yourdomain.com
      service: http://localhost:80
    - service: http_status:404  # <-- This is required
  ```

**"connection refused" or "502 Bad Gateway"**:
- Nginx is not running on the Pi:
  ```bash
  sudo systemctl status nginx
  sudo nginx -t
  sudo systemctl restart nginx
  ```
- BMO Flask app is not running:
  ```bash
  sudo systemctl status bmo
  sudo journalctl -u bmo --since "10 minutes ago"
  sudo systemctl restart bmo
  ```

### Verify DNS records

```bash
# Should return CNAME to <tunnel-id>.cfargotunnel.com
dig bmo.yourdomain.com CNAME
dig signaling.yourdomain.com CNAME
```

If the CNAME records are missing, re-add them:

```bash
cloudflared tunnel route dns bmo bmo.yourdomain.com
cloudflared tunnel route dns bmo signaling.yourdomain.com
```

### Tunnel dashboard

Check the Cloudflare Zero Trust dashboard:
1. **Zero Trust** > **Networks** > **Tunnels**
2. The `bmo` tunnel should show as **Healthy**
3. If it shows **Inactive** or **Down**, the cloudflared process on the Pi is not running

---

## 4. PeerJS Signaling Failures

**Symptoms**: VTT players cannot connect to the game. PeerJS shows "Could not connect to peer" or "Connection lost" errors.

### Check PeerJS server

```bash
sudo systemctl status peerjs
sudo journalctl -u peerjs -f
```

Test the endpoint locally on the Pi:

```bash
curl http://localhost:9000/peerjs
```

Test via Cloudflare Tunnel:

```bash
curl https://signaling.yourdomain.com/peerjs
```

### PeerJS server not responding

```bash
# Restart the service
sudo systemctl restart peerjs

# Check if port 9000 is in use
sudo lsof -i :9000

# Check Node.js is installed
node --version  # Should be v20.x
which peerjs    # Should be in /usr/bin/peerjs or /usr/local/bin/peerjs
```

If peerjs is missing:
```bash
sudo npm install -g peer
```

### WebSocket upgrade failing

If PeerJS connects via HTTP but WebSocket upgrade fails, check Nginx config:

```bash
cat /etc/nginx/sites-enabled/bmo
```

The `/peerjs` location block must include WebSocket headers:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Firewall / NAT issues for players

If signaling works but the actual P2P connection fails:

1. Check that Cloudflare Calls TURN is configured (see cloudflare-setup.md section 4)
2. Verify TURN credentials are being passed to PeerJS
3. Test TURN connectivity:
   ```bash
   # From a player's machine
   curl -X POST "https://rtc.live.cloudflare.com/v1/turn/keys/<APP_ID>/credentials/generate" \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"ttl": 86400}'
   ```
4. If TURN is not set up, players behind strict NAT (mobile networks, corporate firewalls) will fail to connect.

---

## 5. Audio Issues (Microphone, Speakers, TTS)

### No sound output

```bash
# Test speakers
speaker-test -t wav -c 2

# Check ALSA configuration
aplay -l  # List playback devices
cat /proc/asound/cards

# Check audio output is set to headphone jack
sudo raspi-config nonint get_audio  # 1 = headphone jack, 0 = HDMI
sudo raspi-config nonint do_audio 1  # Set to headphone jack

# Test with a WAV file
aplay /usr/share/sounds/alsa/Front_Center.wav
```

### Microphone not working

```bash
# List recording devices
arecord -l

# Record a test clip
arecord -d 5 -f cd test.wav
aplay test.wav

# Check if the USB mic is detected
lsusb | grep -i audio

# Check ALSA mixer levels
alsamixer  # Use F6 to select the mic device, ensure capture is unmuted
```

### Wake word not triggering

1. Check the voice pipeline is running:
   ```bash
   sudo journalctl -u bmo | grep "\[wake\]"
   ```

2. Check the audio input stream:
   ```python
   # Quick test script
   import sounddevice as sd
   import numpy as np
   audio = sd.rec(int(16000 * 3), samplerate=16000, channels=1, dtype='int16')
   sd.wait()
   rms = np.sqrt(np.mean(audio.astype(np.float32) ** 2))
   print(f"RMS: {rms}")  # Should be > 500 when speaking
   ```

3. The default wake word is `hey_jarvis` (placeholder). If using a custom wake word, verify the model file exists in the openwakeword models directory.

4. Check the silence threshold. If the environment is noisy, increase `SILENCE_THRESHOLD` in `voice_pipeline.py` (default: 500).

### TTS not speaking

```bash
# Check if aplay works
echo "test" | piper --model ~/bmo/models/piper/en_US-hfc_female-medium.onnx --output_file /tmp/test.wav
aplay /tmp/test.wav

# Check if GPU TTS is being attempted but failing
sudo journalctl -u bmo | grep "\[tts\]"
```

If GPU TTS fails silently:
- Check GPU server connectivity (section 1)
- Check the speaker profile exists on the GPU server:
  ```bash
  curl -H "Authorization: Bearer <API_KEY>" https://ai.yourdomain.com/tts/speakers
  ```

### Audio crackling or distortion

- Lower the ALSA buffer size in sounddevice settings
- Check CPU usage: `top` -- if CPU is at 100%, audio will glitch
- Try a different sample rate if the USB audio device does not natively support 16kHz

---

## 6. Camera Not Found

**Symptoms**: Camera service skips initialization with `Camera: SKIPPED`. Vision endpoints return errors.

### Check camera hardware

```bash
# Test with libcamera
libcamera-hello --timeout 5000

# List detected cameras
libcamera-hello --list-cameras
```

If no cameras detected:

1. Check the FPC cable connection:
   - Contacts face the PCB on both the Pi and the camera module
   - Camera plugs into **CAM/DISP 0** (closest to USB-C power port)
   - The display goes in **CAM/DISP 1** (closest to HDMI ports)

2. Check that the camera interface is enabled:
   ```bash
   sudo raspi-config nonint get_camera
   # 0 = enabled, 1 = disabled
   sudo raspi-config nonint do_camera 0
   ```

3. Reboot after changing cable or config:
   ```bash
   sudo reboot
   ```

### picamera2 import errors

```bash
source ~/bmo/venv/bin/activate
python3 -c "from picamera2 import Picamera2; print('OK')"
```

If it fails:
```bash
sudo apt install python3-picamera2 python3-libcamera
# picamera2 uses system packages, ensure the venv can access them
```

### Camera works but vision fails

- Object detection requires `ultralytics` and the YOLOv8 model:
  ```bash
  source ~/bmo/venv/bin/activate
  python3 -c "from ultralytics import YOLO; m = YOLO('yolov8n.pt'); print('OK')"
  ```
- Face recognition requires `face_recognition` and `dlib`:
  ```bash
  python3 -c "import face_recognition; print('OK')"
  ```
  `dlib` compilation can fail on Pi. Install with:
  ```bash
  sudo apt install cmake libopenblas-dev liblapack-dev
  pip install dlib face_recognition
  ```

---

## 7. Ollama Model Loading Issues

### Model not found

```bash
ollama list
```

If `bmo` is not listed:
```bash
# Re-create from Modelfile
ollama create bmo -f ~/bmo/Modelfile
```

If the base model is missing:
```bash
# Pi (fallback)
ollama pull gemma3:4b
# or
ollama pull llama3.2:3b

# GPU server
ollama pull llama3.1:70b-instruct-q4_K_M
```

### Out of memory on Pi

The Pi has 8GB RAM. Gemma3:4b needs roughly 3-4GB. If Ollama crashes:

```bash
sudo journalctl -u ollama --since "10 minutes ago" | grep -i "memory\|oom\|killed"
```

Mitigations:
- Reduce `num_ctx` in the agent's `OLLAMA_OPTIONS` (default 8192 on Pi)
- Close other memory-heavy processes
- Use a smaller model: `ollama pull gemma3:1b`

### Ollama not starting on GPU server

```bash
sudo systemctl status ollama
sudo journalctl -u ollama -f

# Check CUDA availability
nvidia-smi
ollama run bmo "test"  # Quick test
```

If Ollama cannot find the GPU:
```bash
# Check CUDA path
echo $PATH | tr ':' '\n' | grep cuda
echo $LD_LIBRARY_PATH | tr ':' '\n' | grep cuda

# Source CUDA env
source /etc/profile.d/cuda.sh
sudo systemctl restart ollama
```

### Model loading takes forever

Large models (70B Q4) take 20-30 seconds to load into VRAM on first request. This is normal. Subsequent requests are fast because the model stays resident.

If loading times are excessive (> 60s):
- Check VRAM usage: `nvidia-smi`
- The A10G has 24GB VRAM. The 70B Q4 model uses ~20GB. If other models are loaded, unload them:
  ```bash
  curl http://localhost:11434/api/delete -d '{"name": "qwen2.5:32b-instruct-q5_K_M"}'
  ```

---

## 8. Fish Speech Voice Quality Issues

**Symptoms**: GPU TTS produces garbled, robotic, or inconsistent audio. NPC voices do not sound distinct.

### Check reference audio files

Fish Speech uses voice cloning from reference WAV files. Quality depends heavily on these references.

```bash
# On GPU server
ls -la /opt/ai-server/data/voices/bmo/
ls -la /opt/ai-server/data/voices/npc/
```

Reference audio requirements:
- **Format**: WAV, 16-bit, mono or stereo
- **Duration**: 5-15 seconds of clean speech (no background noise)
- **Content**: The reference should be a clear, representative sample of the target voice
- **Quality**: No clipping, no reverb, no background music

### Test TTS endpoint directly

```bash
curl -X POST https://ai.yourdomain.com/tts \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I am BMO!", "speaker": "bmo_calm"}' \
  --output /tmp/test_tts.wav

aplay /tmp/test_tts.wav
```

### Fish Speech not installed properly

```bash
# On GPU server
python3 -m fish_speech.inference --help
```

If it fails:
```bash
cd /opt/fish-speech
source /opt/ai-server/venv/bin/activate
pip install -e .
```

### Voice inconsistency between calls

Fish Speech can produce slightly different voices per invocation. To improve consistency:
- Use longer reference audio (10-15s vs 5s)
- Use multiple reference clips and let Fish Speech average them
- Ensure the reference clip matches the emotion/tone you want (happy reference for happy output)

### Timeout errors

Fish Speech inference can take 10-30 seconds for longer text. The default timeout is 30 seconds.

- For long text, consider splitting into shorter sentences on the Pi side before sending to TTS
- Check GPU utilization during TTS: `nvidia-smi`
- If VRAM is full from Ollama, Fish Speech may fail to allocate memory

---

## 9. OLED Display Not Working

**Symptoms**: The 0.96" OLED on the Freenove case shows nothing or garbled output.

### Check I2C connection

```bash
# Scan I2C bus for devices
sudo i2cdetect -y 1
```

The OLED should appear at address `0x3C` (SSD1306) or `0x3D`. If nothing shows:

1. Check I2C is enabled:
   ```bash
   sudo raspi-config nonint get_i2c
   # 0 = enabled
   sudo raspi-config nonint do_i2c 0
   ```

2. Reboot after enabling I2C.

3. Check the OLED ribbon cable is firmly seated in the Freenove expansion board.

### OLED stats service not running

```bash
sudo systemctl status oled-stats
sudo journalctl -u oled-stats -f
```

Common errors:
- **"No module named 'oled'"**: The Freenove code is not in the expected path.
  ```bash
  ls ~/Freenove_Computer_Case_Kit_for_Raspberry_Pi/Code/oled.py
  ```
  If missing, re-clone the repo:
  ```bash
  cd ~
  git clone https://github.com/Freenove/Freenove_Computer_Case_Kit_for_Raspberry_Pi.git
  ```

- **Permission denied**: The OLED service runs as root. Ensure the systemd unit has `User=root`.

### Garbled display

- Wrong I2C address. Edit the OLED initialization to match detected address.
- Wrong display resolution. The Freenove OLED is 128x64 pixels (SSD1306).
- Try reinitializing:
  ```bash
  sudo systemctl restart oled-stats
  ```

---

## 10. LED Controller Issues

**Symptoms**: RGB LEDs do not change color, are stuck on one pattern, or are off entirely.

### Check expansion board communication

```bash
sudo i2cdetect -y 1
```

The Freenove expansion board should appear at an I2C address (typically `0x24`).

### Test LED control manually

```python
import sys
sys.path.insert(0, "/home/patrick/Freenove_Computer_Case_Kit_for_Raspberry_Pi/Code")
from expansion import Expansion

board = Expansion()
board.set_led_mode(4)  # Rainbow mode
print(f"Temp: {board.get_temp()}C")
board.end()
```

### LEDs not changing with BMO mood

The agent emits `[LED:color]` tags in responses, which should be parsed by the Pi app to control LEDs. If LEDs are static:

1. Check that the Freenove expansion library is importable:
   ```bash
   source ~/bmo/venv/bin/activate
   python3 -c "import sys; sys.path.insert(0, '/home/patrick/Freenove_Computer_Case_Kit_for_Raspberry_Pi/Code'); from expansion import Expansion; print('OK')"
   ```

2. Check BMO app logs for LED-related errors:
   ```bash
   sudo journalctl -u bmo | grep -i "led\|expansion"
   ```

### Fan control

If the fans are not spinning:

```bash
# Check CPU temperature
cat /sys/class/thermal/thermal_zone0/temp  # Divide by 1000 for Celsius
```

The default fan config is auto mode with ramp between 35-50C. If the CPU is cool, fans will not spin. To force fans on:

```python
from expansion import Expansion
board = Expansion()
board.set_fan_mode(1)  # Manual mode
board.set_fan_speed(50)  # 50% speed
board.end()
```

---

## General Diagnostic Commands

### Pi system health

```bash
# CPU temp and throttling
vcgencmd measure_temp
vcgencmd get_throttled  # 0x0 = no throttling

# Memory
free -h

# Disk
df -h

# All BMO services
sudo systemctl status bmo peerjs cloudflared oled-stats ollama nginx

# Network
hostname -I
ping ai.yourdomain.com
curl -s https://bmo.yourdomain.com/api/weather | python3 -m json.tool
```

### GPU server health

```bash
# SSH into EC2
nvidia-smi
sudo systemctl status ai-server ollama nginx spot-monitor
curl http://localhost:8000/health
curl http://localhost:8000/gpu/status
ollama list
```

### Full service restart (Pi)

```bash
sudo systemctl restart ollama
sleep 5
sudo systemctl restart bmo
sudo systemctl restart peerjs
sudo systemctl restart cloudflared
sudo systemctl restart oled-stats
sudo systemctl restart nginx
```

### Full service restart (EC2)

```bash
sudo systemctl restart ollama
sleep 10
sudo systemctl restart ai-server
sudo systemctl restart spot-monitor
sudo systemctl restart nginx
```

### Check all logs at once (Pi)

```bash
sudo journalctl -u bmo -u peerjs -u cloudflared -u ollama --since "30 minutes ago" --no-pager
```
