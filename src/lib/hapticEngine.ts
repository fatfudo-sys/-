import type { AudioFeatures, EngineSettings, HapticTarget, MotionFeatures, Scene } from "./types.ts";

/** Per-scene shaping of how features map onto the two motors. */
const PROFILES: Record<Scene, { lowW: number; highW: number; motionW: number; transientW: number }> = {
  //            strong(low)          weak(high)
  idle: { lowW: 0.0, highW: 0.0, motionW: 0.0, transientW: 0.0 },
  walk: { lowW: 1.15, highW: 0.5, motionW: 0.6, transientW: 1.2 }, // punchy footfalls
  engine: { lowW: 1.3, highW: 0.35, motionW: 0.3, transientW: 0.3 }, // sustained rumble
  touch: { lowW: 0.25, highW: 1.25, motionW: 0.2, transientW: 0.9 }, // fine detail on weak motor
  impact: { lowW: 1.4, highW: 1.1, motionW: 0.4, transientW: 1.6 }, // hit both hard
};

/**
 * Turns per-frame features into smoothed motor magnitudes. Applies user gain /
 * floor, a per-scene profile, and an attack/release envelope so the rumble
 * feels physical instead of jittery.
 */
export class HapticEngine {
  private strongEnv = 0;
  private weakEnv = 0;

  compute(a: AudioFeatures, m: MotionFeatures, scene: Scene, s: EngineSettings): HapticTarget {
    if (!s.enabled) {
      this.strongEnv = 0;
      this.weakEnv = 0;
      return { strong: 0, weak: 0 };
    }

    const audio = s.useAudio ? a : { low: 0, mid: 0, high: 0, rms: 0, transient: 0 };
    const motion = s.useMotion ? m : { intensity: 0, vertical: 0 };
    const profile = s.useScene ? PROFILES[scene] : PROFILES.idle;

    // When scene shaping is off, fall back to a neutral mapping so audio/motion
    // still drive the motors directly.
    const p = s.useScene
      ? profile
      : { lowW: 1, highW: 1, motionW: 0.6, transientW: 1 };

    let strong = audio.low * p.lowW * s.lowGain + motion.intensity * p.motionW;
    let weak = audio.high * p.highW * s.highGain + audio.transient * p.transientW;

    strong *= s.gain;
    weak *= s.gain;

    // Noise floor: ignore low-level ambience.
    strong = strong <= s.floor ? 0 : strong;
    weak = weak <= s.floor ? 0 : weak;

    strong = clamp01(strong);
    weak = clamp01(weak);

    // Envelope: fast attack, slower release.
    this.strongEnv = envelope(this.strongEnv, strong, 0.6, 0.12);
    this.weakEnv = envelope(this.weakEnv, weak, 0.85, 0.25);

    return { strong: clamp01(this.strongEnv), weak: clamp01(this.weakEnv) };
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function envelope(current: number, target: number, attack: number, release: number): number {
  const rate = target > current ? attack : release;
  return current + (target - current) * rate;
}
