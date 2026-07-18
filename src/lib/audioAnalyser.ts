import type { AudioFeatures } from "./types.ts";

/**
 * Taps the <video> element's audio track through a Web Audio graph and exposes
 * per-frame frequency-band features. Audio still plays through the speakers
 * because we route source -> analyser -> destination.
 */
export class AudioAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  // Kept referenced so the source node isn't garbage-collected mid-playback.
  private source: MediaElementAudioSourceNode | null = null;
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private prevRms = 0;

  constructor(private readonly media: HTMLMediaElement) {}

  /** Must be called from a user gesture (browsers block AudioContext otherwise). */
  async ensureStarted(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;

    // A MediaElementSource can only be created once per element.
    const source = ctx.createMediaElementSource(this.media);
    source.connect(analyser);
    analyser.connect(ctx.destination); // keep audible

    this.ctx = ctx;
    this.analyser = analyser;
    this.source = source;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    if (ctx.state === "suspended") await ctx.resume();
  }

  /** Read one frame of features. Returns silence if not started yet. */
  read(): AudioFeatures {
    const silent: AudioFeatures = { low: 0, mid: 0, high: 0, rms: 0, transient: 0 };
    if (!this.analyser || !this.ctx) return silent;

    this.analyser.getByteFrequencyData(this.freq);
    const nyquist = this.ctx.sampleRate / 2;
    const bins = this.freq.length;
    const hzPerBin = nyquist / bins;

    const bandEnergy = (loHz: number, hiHz: number): number => {
      const lo = Math.max(0, Math.floor(loHz / hzPerBin));
      const hi = Math.min(bins - 1, Math.ceil(hiHz / hzPerBin));
      let sum = 0;
      for (let i = lo; i <= hi; i++) sum += this.freq[i];
      const count = Math.max(1, hi - lo + 1);
      return sum / count / 255; // normalise 0..1
    };

    const low = bandEnergy(20, 160);
    const mid = bandEnergy(160, 2000);
    const high = bandEnergy(2000, 8000);
    const rms = (low + mid + high) / 3;

    // Onset detection: positive change in loudness relative to previous frame.
    const transient = Math.max(0, rms - this.prevRms) * 3;
    this.prevRms = rms;

    return {
      low,
      mid,
      high,
      rms,
      transient: Math.min(1, transient),
    };
  }

  /** Tear down the audio graph (e.g. when swapping the media element). */
  disconnect(): void {
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
  }
}
