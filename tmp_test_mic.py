import sounddevice as sd
import numpy as np

print("Default input:", sd.default.device)
print("Input devices:")
for i, d in enumerate(sd.query_devices()):
    if d["max_input_channels"] > 0:
        print(f"  [{i}] {d['name']} ch={d['max_input_channels']} rate={d['default_samplerate']}")

default_in = sd.query_devices(kind="input")
print(f"\nUsing: {default_in['name']}")

print("\nRecording 3s...")
audio = sd.rec(int(3 * 16000), samplerate=16000, channels=1, dtype="int16")
sd.wait()
rms = np.sqrt(np.mean(audio.astype(np.float32) ** 2))
peak = int(np.max(np.abs(audio)))
print(f"RMS={rms:.1f}  Peak={peak}  Samples={len(audio)}")
if rms < 50:
    print("DEAD - no audio at all")
elif rms < 300:
    print("LOW - ambient noise only")
else:
    print("OK - mic is picking up audio")
