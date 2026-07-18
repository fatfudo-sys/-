import type { AudioFeatures, MotionFeatures, Scene } from "./types.ts";

/**
 * Lightweight, model-free scene classifier. It keeps a short rolling history of
 * audio + motion features and applies heuristics to guess what kind of physical
 * event the frame represents. This gives the "AI scene detection" behaviour
 * without shipping a neural net; the same interface can later be backed by a
 * TensorFlow.js model (feed `push()` output as features, return the label).
 */
export class SceneClassifier {
  private history: Array<{ a: AudioFeatures; m: MotionFeatures }> = [];
  private readonly maxLen = 45; // ~0.75s at 60fps
  private lastTransientAt = -Infinity;
  private frame = 0;
  private current: Scene = "idle";

  push(a: AudioFeatures, m: MotionFeatures): Scene {
    this.frame++;
    this.history.push({ a, m });
    if (this.history.length > this.maxLen) this.history.shift();
    if (a.transient > 0.25) this.lastTransientAt = this.frame;
    this.current = this.classify();
    return this.current;
  }

  get scene(): Scene {
    return this.current;
  }

  private mean(sel: (h: { a: AudioFeatures; m: MotionFeatures }) => number): number {
    if (this.history.length === 0) return 0;
    let s = 0;
    for (const h of this.history) s += sel(h);
    return s / this.history.length;
  }

  private variance(sel: (h: { a: AudioFeatures; m: MotionFeatures }) => number): number {
    if (this.history.length < 2) return 0;
    const mu = this.mean(sel);
    let s = 0;
    for (const h of this.history) s += (sel(h) - mu) ** 2;
    return s / this.history.length;
  }

  private classify(): Scene {
    const low = this.mean((h) => h.a.low);
    const high = this.mean((h) => h.a.high);
    const rms = this.mean((h) => h.a.rms);
    const motion = this.mean((h) => h.m.intensity);
    const lowVar = this.variance((h) => h.a.low);
    const recentTransient = this.frame - this.lastTransientAt < 8;

    // Very quiet & still -> nothing happening.
    if (rms < 0.05 && motion < 0.05) return "idle";

    // Impact: a strong, fresh broadband transient.
    if (recentTransient && rms > 0.35 && low > 0.25) return "impact";

    // Engine: sustained low-frequency energy that stays fairly steady (low variance).
    if (low > 0.22 && lowVar < 0.01 && low >= high) return "engine";

    // Walk: rhythmic low-frequency hits (higher variance in low band) or a
    // vertically-biased image motion (the camera bob) with periodic transients.
    if ((low > 0.12 && lowVar > 0.015) || (recentTransient && motion > 0.15)) {
      return "walk";
    }

    // Touch: quiet, high-frequency-dominant detail with little low end.
    if (high > 0.1 && high > low && rms < 0.35) return "touch";

    return low > high ? "engine" : "touch";
  }
}
