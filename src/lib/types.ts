/** Per-frame features extracted from the video's audio track. All 0..1. */
export interface AudioFeatures {
  /** Low-band energy (~20–160 Hz): engine rumble, footfalls, explosions. */
  low: number;
  /** Mid-band energy (~160–2000 Hz). */
  mid: number;
  /** High-band energy (~2–8 kHz): texture, clicks, foley detail. */
  high: number;
  /** Broadband loudness (RMS). */
  rms: number;
  /** Onset / transient strength this frame (sudden energy jump). */
  transient: number;
}

/** Per-frame features extracted from the video image. All 0..1. */
export interface MotionFeatures {
  /** Global motion magnitude (mean abs frame difference). */
  intensity: number;
  /** Vertical-dominant motion bias — useful for detecting a walking bob. */
  vertical: number;
}

export type Scene = "idle" | "walk" | "engine" | "touch" | "impact";

/** Final magnitudes sent to the two rumble motors. Both 0..1. */
export interface HapticTarget {
  /** Strong / low-frequency motor. */
  strong: number;
  /** Weak / high-frequency motor. */
  weak: number;
}

export interface EngineSettings {
  enabled: boolean;
  useAudio: boolean;
  useMotion: boolean;
  useScene: boolean;
  sceneMode: "auto" | Scene;
  gain: number;
  floor: number;
  lowGain: number;
  highGain: number;
}
