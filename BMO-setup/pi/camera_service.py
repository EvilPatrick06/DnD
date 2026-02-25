"""BMO Camera Service — GPU-accelerated vision with local fallback.

Routes object detection to GPU server (YOLOv8-Large) and vision descriptions
to GPU server (LLM + vision). Falls back to local YOLOv8-Nano and Ollama.
"""

import io
import os
import pickle
import threading
import time

import cv2
import numpy as np
import requests

DATA_DIR = os.path.expanduser("~/bmo/data")
KNOWN_FACES_PATH = os.path.join(DATA_DIR, "known_faces.pkl")
SNAPSHOTS_DIR = os.path.join(DATA_DIR, "snapshots")

# GPU server config
GPU_SERVER_URL = os.environ.get("GPU_SERVER_URL", "https://ai.yourdomain.com")
GPU_SERVER_KEY = os.environ.get("GPU_SERVER_KEY", "")


def _gpu_headers() -> dict:
    headers = {}
    if GPU_SERVER_KEY:
        headers["Authorization"] = f"Bearer {GPU_SERVER_KEY}"
    return headers


def _check_gpu() -> bool:
    try:
        from agent import _check_gpu_available
        return _check_gpu_available()
    except ImportError:
        try:
            r = requests.get(f"{GPU_SERVER_URL}/health", timeout=3, headers=_gpu_headers())
            return r.status_code == 200
        except Exception:
            return False


class CameraService:
    """Manages the Pi camera for streaming, face recognition, object detection, and OCR."""

    def __init__(self, socketio=None):
        self.socketio = socketio
        self._camera = None
        self._yolo = None
        self._ocr_reader = None
        self._known_faces = {}
        self._motion_enabled = False
        self._motion_thread = None
        self._prev_frame = None
        self._lock = threading.Lock()

        os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

    # ── Camera Lifecycle ─────────────────────────────────────────────

    def start(self):
        """Initialize the Pi camera."""
        if self._camera is not None:
            return
        from picamera2 import Picamera2

        self._camera = Picamera2()
        config = self._camera.create_still_configuration(
            main={"size": (1280, 960), "format": "RGB888"},
            lores={"size": (640, 480), "format": "RGB888"},
        )
        self._camera.configure(config)
        self._camera.start()
        time.sleep(1)  # Warm-up

    def stop(self):
        """Stop the camera."""
        self.stop_motion_detection()
        if self._camera:
            self._camera.stop()
            self._camera = None

    def capture_frame(self) -> np.ndarray:
        """Capture a single frame from the camera. Returns BGR numpy array."""
        if self._camera is None:
            self.start()
        frame_rgb = self._camera.capture_array("lores")
        return cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)

    def capture_full_res(self) -> np.ndarray:
        """Capture a full-resolution frame."""
        if self._camera is None:
            self.start()
        frame_rgb = self._camera.capture_array("main")
        return cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)

    # ── MJPEG Stream ─────────────────────────────────────────────────

    def generate_mjpeg(self):
        """Generator that yields MJPEG frames for Flask streaming response."""
        while True:
            frame = self.capture_frame()
            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
            )
            time.sleep(0.1)  # ~10 FPS

    # ── Snapshots ────────────────────────────────────────────────────

    def take_snapshot(self) -> str:
        """Capture a full-res photo and save it. Returns the file path."""
        frame = self.capture_full_res()
        filename = f"snapshot_{int(time.time())}.jpg"
        path = os.path.join(SNAPSHOTS_DIR, filename)
        cv2.imwrite(path, frame)
        return path

    # ── Face Recognition ─────────────────────────────────────────────

    def _load_known_faces(self):
        if not self._known_faces and os.path.exists(KNOWN_FACES_PATH):
            with open(KNOWN_FACES_PATH, "rb") as f:
                self._known_faces = pickle.load(f)
        return self._known_faces

    def identify_faces(self, frame: np.ndarray = None) -> list[dict]:
        """Detect and identify faces in a frame. Returns list of {name, location}."""
        import face_recognition

        if frame is None:
            frame = self.capture_frame()

        known = self._load_known_faces()

        # Downscale for speed
        small = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

        locations = face_recognition.face_locations(rgb_small, model="hog")
        encodings = face_recognition.face_encodings(rgb_small, locations)

        results = []
        for encoding, location in zip(encodings, locations):
            name = "unknown"
            for known_name, known_encs in known.items():
                matches = face_recognition.compare_faces(known_encs, encoding, tolerance=0.5)
                if any(matches):
                    name = known_name
                    break

            # Scale location back to original size
            top, right, bottom, left = [v * 4 for v in location]
            results.append({"name": name, "location": {"top": top, "right": right, "bottom": bottom, "left": left}})

        return results

    def enroll_face(self, name: str, image_paths: list[str]):
        """Register a person's face from multiple photos."""
        import face_recognition

        encodings = []
        for path in image_paths:
            img = face_recognition.load_image_file(path)
            encs = face_recognition.face_encodings(img)
            if encs:
                encodings.append(encs[0])

        if not encodings:
            raise ValueError("No faces detected in provided images")

        known = self._load_known_faces()
        known[name] = encodings

        os.makedirs(os.path.dirname(KNOWN_FACES_PATH), exist_ok=True)
        with open(KNOWN_FACES_PATH, "wb") as f:
            pickle.dump(known, f)

        print(f"[face] Enrolled '{name}' with {len(encodings)} face encodings")

    # ── Object Detection (GPU YOLOv8-Large → local YOLOv8-Nano) ─────

    def _load_yolo(self):
        if self._yolo is None:
            from ultralytics import YOLO
            self._yolo = YOLO("yolov8n.pt")
        return self._yolo

    def detect_objects(self, frame: np.ndarray = None) -> list[dict]:
        """Detect objects in a frame. Routes to GPU (YOLOv8-Large) with local fallback."""
        if frame is None:
            frame = self.capture_frame()

        if _check_gpu():
            try:
                return self._gpu_detect_objects(frame)
            except Exception as e:
                print(f"[vision] GPU detection failed ({e}), falling back to local")

        return self._local_detect_objects(frame)

    def _gpu_detect_objects(self, frame: np.ndarray) -> list[dict]:
        """Send frame to GPU server for YOLOv8-Large detection."""
        _, jpeg = cv2.imencode(".jpg", frame)
        files = {"image": ("frame.jpg", jpeg.tobytes(), "image/jpeg")}
        r = requests.post(
            f"{GPU_SERVER_URL}/vision/detect",
            files=files,
            headers=_gpu_headers(),
            timeout=10,
        )
        r.raise_for_status()
        raw = r.json().get("detections", [])
        # Normalize bbox format
        detections = []
        for d in raw:
            bbox = d.get("bbox", [0, 0, 0, 0])
            detections.append({
                "class": d["class"],
                "confidence": d["confidence"],
                "bbox": {"x1": int(bbox[0]), "y1": int(bbox[1]), "x2": int(bbox[2]), "y2": int(bbox[3])},
            })
        return detections

    def _local_detect_objects(self, frame: np.ndarray) -> list[dict]:
        """Detect with local YOLOv8-Nano (fallback, lower accuracy)."""
        model = self._load_yolo()
        results = model(frame, verbose=False)

        detections = []
        for r in results:
            for box in r.boxes:
                cls = model.names[int(box.cls)]
                conf = float(box.conf)
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class": cls,
                    "confidence": round(conf, 2),
                    "bbox": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
                })

        return detections

    # ── OCR ──────────────────────────────────────────────────────────

    def _load_ocr(self):
        if self._ocr_reader is None:
            import easyocr
            self._ocr_reader = easyocr.Reader(["en"], gpu=False)
        return self._ocr_reader

    def read_text(self, frame: np.ndarray = None) -> str:
        """Read text from a camera frame using OCR."""
        if frame is None:
            frame = self.capture_frame()

        reader = self._load_ocr()
        results = reader.readtext(frame)
        return " ".join(r[1] for r in results)

    # ── Vision Description (GPU LLM → local Ollama → detection fallback) ──

    def describe_scene(self, prompt: str = "What do you see?") -> str:
        """Describe what the camera sees using LLM vision.

        Routes to GPU server first, falls back to local Ollama,
        then falls back to object detection + face recognition text summary.
        """
        frame = self.capture_frame()

        # Try GPU server first
        if _check_gpu():
            try:
                return self._gpu_describe(frame, prompt)
            except Exception as e:
                print(f"[vision] GPU describe failed ({e}), trying local")

        # Try local Ollama
        try:
            return self._local_describe(frame, prompt)
        except Exception as e:
            print(f"[vision] Local describe failed ({e}), using detection fallback")

        # Fallback: combine detection + face recognition into text
        return self._detection_fallback(frame)

    def _gpu_describe(self, frame: np.ndarray, prompt: str) -> str:
        """Send frame to GPU server for LLM vision description."""
        _, jpeg = cv2.imencode(".jpg", frame)
        files = {"image": ("frame.jpg", jpeg.tobytes(), "image/jpeg")}
        data = {"prompt": prompt}
        r = requests.post(
            f"{GPU_SERVER_URL}/vision/describe",
            files=files,
            data=data,
            headers=_gpu_headers(),
            timeout=30,
        )
        r.raise_for_status()
        return r.json().get("description", "")

    def _local_describe(self, frame: np.ndarray, prompt: str) -> str:
        """Describe with local Ollama vision model."""
        import ollama as ollama_client

        temp_path = os.path.join(DATA_DIR, "vision_temp.jpg")
        cv2.imwrite(temp_path, frame)

        try:
            response = ollama_client.chat(
                model="bmo",
                messages=[{
                    "role": "user",
                    "content": prompt,
                    "images": [temp_path],
                }],
            )
            return response["message"]["content"]
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def _detection_fallback(self, frame: np.ndarray) -> str:
        """Build a text description from object detection + face recognition."""
        objects = self.detect_objects(frame)
        faces = self.identify_faces(frame)
        parts = []
        if faces:
            names = [f["name"] for f in faces]
            parts.append(f"I see: {', '.join(names)}")
        if objects:
            obj_summary = {}
            for obj in objects:
                obj_summary[obj["class"]] = obj_summary.get(obj["class"], 0) + 1
            obj_strs = [f"{count} {cls}" if count > 1 else cls for cls, count in obj_summary.items()]
            parts.append(f"Objects: {', '.join(obj_strs)}")
        return " | ".join(parts) if parts else "BMO's eyes are fuzzy right now"

    # ── Motion Detection ─────────────────────────────────────────────

    def start_motion_detection(self, threshold: float = 25.0, min_area: int = 5000):
        """Start background motion detection. Emits 'motion_detected' events."""
        if self._motion_enabled:
            return
        self._motion_enabled = True
        self._motion_thread = threading.Thread(
            target=self._motion_loop, args=(threshold, min_area), daemon=True
        )
        self._motion_thread.start()

    def stop_motion_detection(self):
        """Stop motion detection."""
        self._motion_enabled = False

    def _motion_loop(self, threshold: float, min_area: int):
        """Background loop that compares frames for motion."""
        self._prev_frame = None

        while self._motion_enabled:
            frame = self.capture_frame()
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (21, 21), 0)

            if self._prev_frame is None:
                self._prev_frame = gray
                time.sleep(1)
                continue

            delta = cv2.absdiff(self._prev_frame, gray)
            thresh = cv2.threshold(delta, threshold, 255, cv2.THRESH_BINARY)[1]
            thresh = cv2.dilate(thresh, None, iterations=2)

            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            motion_detected = any(cv2.contourArea(c) > min_area for c in contours)

            if motion_detected:
                # Try to identify what triggered the motion
                objects = self.detect_objects(frame)
                description = ", ".join(set(o["class"] for o in objects[:5])) or "movement"
                self._emit("motion_detected", {"description": description, "timestamp": time.time()})

                # Cooldown to avoid spam
                time.sleep(10)

            self._prev_frame = gray
            time.sleep(2)  # Check every 2 seconds

    # ── Helpers ──────────────────────────────────────────────────────

    def _emit(self, event: str, data: dict):
        if self.socketio:
            self.socketio.emit(event, data)
