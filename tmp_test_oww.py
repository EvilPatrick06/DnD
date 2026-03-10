import sounddevice as sd
import numpy as np
import sys
sys.path.insert(0, "/home/patrick/bmo")

try:
    import openwakeword
    from openwakeword.model import Model
    import os

    model_dir = os.path.join(os.path.dirname(openwakeword.__file__), "resources", "models")
    print(f"Model dir: {model_dir}")
    
    models = [f for f in os.listdir(model_dir) if f.endswith(".onnx")]
    print(f"Available models: {models}")

    wake_words = ["hey_jarvis"]
    paths = []
    for name in wake_words:
        for candidate in [f"{name}.onnx", f"{name}_v0.1.onnx"]:
            full = os.path.join(model_dir, candidate)
            if os.path.isfile(full):
                paths.append(full)
                print(f"Found model: {full}")
                break
        else:
            print(f"WARNING: No model found for {name}")

    if not paths:
        print("ERROR: No wake word models found!")
        sys.exit(1)

    oww = Model(wakeword_models=paths)
    print(f"OWW model loaded, labels: {oww.prediction_buffer.keys()}")

    THRESHOLD = float(os.environ.get("BMO_WAKE_THRESHOLD", "0.5"))
    print(f"Wake threshold: {THRESHOLD}")
    
    chunk_size = 1280
    print(f"\nListening for 10 seconds - say 'hey jarvis' or 'hey BMO'...")
    print("Scores will be printed when > 0.1")

    import queue
    audio_q = queue.Queue()
    
    def cb(indata, frames, time_info, status):
        if status:
            print(f"Audio status: {status}")
        audio_q.put(indata.copy())

    with sd.InputStream(samplerate=16000, channels=1, dtype="int16",
                        blocksize=chunk_size, callback=cb):
        import time
        end = time.time() + 10
        max_score = 0.0
        chunks_processed = 0
        while time.time() < end:
            try:
                chunk = audio_q.get(timeout=1.0)
            except:
                continue
            chunks_processed += 1
            audio_f32 = chunk.flatten().astype(np.float32) / 32768.0
            prediction = oww.predict(audio_f32)
            for key, score in prediction.items():
                if score > max_score:
                    max_score = score
                if score > 0.1:
                    print(f"  [{key}] score={score:.4f} {'*** TRIGGERED ***' if score > THRESHOLD else ''}")
        
        print(f"\nDone. Processed {chunks_processed} chunks. Max score seen: {max_score:.4f}")
        if max_score < 0.1:
            print("No activity at all - model may not be receiving proper audio")
        elif max_score < THRESHOLD:
            print(f"Some activity but below threshold ({THRESHOLD}). Try lowering BMO_WAKE_THRESHOLD")
        else:
            print("Wake word detected successfully!")
            
except Exception as e:
    import traceback
    print(f"Error: {e}")
    traceback.print_exc()
