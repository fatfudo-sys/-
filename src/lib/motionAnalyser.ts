import type { MotionFeatures } from "./types.ts";

/**
 * Estimates global motion by drawing the video into a tiny offscreen canvas and
 * comparing consecutive frames (mean absolute luma difference). Cheap enough to
 * run every animation frame. Also reports whether motion is vertically biased,
 * which helps identify a walking "bob".
 */
export class MotionAnalyser {
  private canvas: HTMLCanvasElement;
  private cctx: CanvasRenderingContext2D;
  private prev: Uint8ClampedArray | null = null;
  private readonly w = 64;
  private readonly h = 36;

  constructor(private readonly video: HTMLVideoElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.cctx = ctx;
  }

  read(): MotionFeatures {
    const none: MotionFeatures = { intensity: 0, vertical: 0 };
    if (this.video.readyState < 2 || this.video.videoWidth === 0) return none;

    this.cctx.drawImage(this.video, 0, 0, this.w, this.h);
    const frame = this.cctx.getImageData(0, 0, this.w, this.h).data;

    if (!this.prev) {
      this.prev = frame.slice();
      return none;
    }

    let diffSum = 0;
    let topDiff = 0;
    let bottomDiff = 0;
    const half = (this.h / 2) * this.w;

    for (let p = 0, i = 0; i < frame.length; i += 4, p++) {
      // luma difference, ignoring alpha
      const l1 = frame[i] * 0.299 + frame[i + 1] * 0.587 + frame[i + 2] * 0.114;
      const l0 = this.prev[i] * 0.299 + this.prev[i + 1] * 0.587 + this.prev[i + 2] * 0.114;
      const d = Math.abs(l1 - l0);
      diffSum += d;
      if (p < half) topDiff += d;
      else bottomDiff += d;
    }
    this.prev.set(frame);

    const pixels = this.w * this.h;
    const intensity = Math.min(1, diffSum / pixels / 48); // scale to a useful 0..1
    // Vertical bias: how unevenly motion splits top vs bottom (proxy for bob/tilt).
    const total = topDiff + bottomDiff || 1;
    const vertical = Math.min(1, Math.abs(topDiff - bottomDiff) / total);

    return { intensity, vertical };
  }
}
