// On-device gesture + gaze engine (MediaPipe tasks-vision).
//
// Privacy contract: the camera stream is processed entirely in this
// browser tab — hand and face landmarks never leave the device. This
// runs ONLY while the user has toggled gestures on.
//
// Gesture grammar (deliberate, small, learnable):
//   open palm      -> hush: silence Leviathan, dismiss panels
//   thumb up/down  -> answer yes / no
//   two-finger V   -> start listening (no wake word needed)
// The face position drives the entity's gaze-follow.

import type {
  FaceDetector,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const GESTURE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export type GestureName =
  | "Open_Palm"
  | "Closed_Fist"
  | "Thumb_Up"
  | "Thumb_Down"
  | "Victory"
  | "Pointing_Up"
  | "ILoveYou";

const ACTIONABLE: GestureName[] = [
  "Open_Palm",
  "Closed_Fist",
  "Thumb_Up",
  "Thumb_Down",
  "Victory",
  "Pointing_Up",
  "ILoveYou",
];

const CONFIRM_FRAMES = 3; // consecutive detections before firing
const COOLDOWN_MS = 1800; // between fired gestures

export interface GestureCallbacks {
  onGesture: (name: GestureName) => void;
  onFace: (pos: { x: number; y: number } | null) => void;
  onReady: () => void;
  onError: (message: string) => void;
}

export class GestureEngine {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private recognizer: GestureRecognizer | null = null;
  private faceDetector: FaceDetector | null = null;
  private rafId = 0;
  private stopped = false;

  private candidate: string | null = null;
  private candidateCount = 0;
  private lastFired = 0;
  private lastFaceCheck = 0;

  constructor(private cb: GestureCallbacks) {}

  async start() {
    this.stopped = false;
    try {
      const { FilesetResolver, GestureRecognizer, FaceDetector } =
        await import("@mediapipe/tasks-vision");

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const video = document.createElement("video");
      video.srcObject = this.stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      this.video = video;

      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      this.recognizer = await GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
      this.faceDetector = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
      });

      if (this.stopped) return this.stop(); // toggled off mid-load
      this.cb.onReady();
      this.loop();
    } catch {
      this.cb.onError("gestures need a camera and a modern browser");
      this.stop();
    }
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recognizer?.close();
    this.recognizer = null;
    this.faceDetector?.close();
    this.faceDetector = null;
    this.video = null;
    this.cb.onFace(null);
  }

  private loop = () => {
    if (this.stopped || !this.video || this.video.readyState < 2) {
      if (!this.stopped) this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    const now = performance.now();

    // Hands every frame (cheap enough at 640px, single hand)
    try {
      const res = this.recognizer!.recognizeForVideo(this.video, now);
      const top = res.gestures?.[0]?.[0];
      this.track(top && top.score > 0.55 ? top.categoryName : null);
    } catch {
      /* single bad frame — keep looping */
    }

    // Face ~5x/s is plenty for a slow gaze lean
    if (now - this.lastFaceCheck > 200) {
      this.lastFaceCheck = now;
      try {
        const faces = this.faceDetector!.detectForVideo(this.video, now);
        const box = faces.detections?.[0]?.boundingBox;
        if (box && this.video.videoWidth) {
          const cx = (box.originX + box.width / 2) / this.video.videoWidth;
          const cy = (box.originY + box.height / 2) / this.video.videoHeight;
          // Mirror x (webcam) and map to [-1, 1], y up
          this.cb.onFace({ x: (0.5 - cx) * 2, y: (0.5 - cy) * 2 });
        } else {
          this.cb.onFace(null);
        }
      } catch {
        /* keep looping */
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private track(name: string | null) {
    if (!name || !ACTIONABLE.includes(name as GestureName)) {
      this.candidate = null;
      this.candidateCount = 0;
      return;
    }
    if (name === this.candidate) {
      this.candidateCount++;
    } else {
      this.candidate = name;
      this.candidateCount = 1;
    }
    const now = Date.now();
    if (
      this.candidateCount >= CONFIRM_FRAMES &&
      now - this.lastFired > COOLDOWN_MS
    ) {
      this.lastFired = now;
      this.candidateCount = 0;
      this.cb.onGesture(name as GestureName);
    }
  }
}
