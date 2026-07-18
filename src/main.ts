import "./styles.css";
import { AudioAnalyser } from "./lib/audioAnalyser.ts";
import { MotionAnalyser } from "./lib/motionAnalyser.ts";
import { SceneClassifier } from "./lib/sceneClassifier.ts";
import { HapticEngine } from "./lib/hapticEngine.ts";
import { GamepadManager } from "./lib/gamepadManager.ts";
import type { EngineSettings, Scene } from "./lib/types.ts";

const SCENE_LABEL: Record<Scene, string> = {
  idle: "待機",
  walk: "走路 / 腳步",
  engine: "車 / 引擎",
  touch: "觸摸 / 細節",
  impact: "衝擊 / 碰撞",
};

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const video = $<HTMLVideoElement>("video");
const fileInput = $<HTMLInputElement>("file-input");
const dropHint = $<HTMLDivElement>("drop-hint");
const gpStatus = $<HTMLDivElement>("gamepad-status");
const sceneLabel = $<HTMLElement>("scene-label");
const mStrong = $<HTMLElement>("m-strong");
const mWeak = $<HTMLElement>("m-weak");
const mMotion = $<HTMLElement>("m-motion");

const audioAnalyser = new AudioAnalyser(video);
const motionAnalyser = new MotionAnalyser(video);
const classifier = new SceneClassifier();
const engine = new HapticEngine();
const gamepad = new GamepadManager();

const settings: EngineSettings = {
  enabled: true,
  useAudio: true,
  useMotion: true,
  useScene: true,
  sceneMode: "auto",
  gain: 1,
  floor: 0.06,
  lowGain: 1,
  highGain: 1,
};

// ---- Gamepad status ----
gamepad.onStatusChange = (connected, id) => {
  gpStatus.textContent = connected ? `已連接:${id ?? "手把"}` : "未偵測到手把";
  gpStatus.classList.toggle("pill--on", connected);
  gpStatus.classList.toggle("pill--off", !connected);
};
gamepad.start();

// ---- Video loading (file picker + drag & drop) ----
function loadFile(file: File): void {
  if (!file.type.startsWith("video/")) return;
  video.src = URL.createObjectURL(file);
  dropHint.classList.add("hidden");
  void video.play().catch(() => {});
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) loadFile(f);
});

const stage = video.parentElement!;
["dragover", "dragenter"].forEach((ev) =>
  stage.addEventListener(ev, (e) => {
    e.preventDefault();
    stage.classList.add("dragging");
  }),
);
["dragleave", "drop"].forEach((ev) =>
  stage.addEventListener(ev, (e) => {
    e.preventDefault();
    stage.classList.remove("dragging");
  }),
);
stage.addEventListener("drop", (e) => {
  const f = (e as DragEvent).dataTransfer?.files?.[0];
  if (f) loadFile(f);
});

// AudioContext needs a user gesture — start it when playback begins.
video.addEventListener("play", () => {
  void audioAnalyser.ensureStarted();
});
video.addEventListener("pause", () => gamepad.stopRumble());
video.addEventListener("ended", () => gamepad.stopRumble());

// ---- Control wiring ----
const bindToggle = (id: string, key: keyof EngineSettings): void => {
  const el = $<HTMLInputElement>(id);
  el.addEventListener("change", () => {
    (settings[key] as boolean) = el.checked;
  });
};
bindToggle("enabled", "enabled");
bindToggle("src-audio", "useAudio");
bindToggle("src-motion", "useMotion");
bindToggle("src-scene", "useScene");

$<HTMLSelectElement>("scene-mode").addEventListener("change", (e) => {
  settings.sceneMode = (e.target as HTMLSelectElement).value as EngineSettings["sceneMode"];
});

const bindSlider = (id: string, outId: string, key: keyof EngineSettings): void => {
  const el = $<HTMLInputElement>(id);
  const out = $<HTMLOutputElement>(outId);
  const apply = () => {
    (settings[key] as number) = parseFloat(el.value);
    out.textContent = parseFloat(el.value).toFixed(2);
  };
  el.addEventListener("input", apply);
  apply();
};
bindSlider("gain", "o-gain", "gain");
bindSlider("floor", "o-floor", "floor");
bindSlider("low-gain", "o-low", "lowGain");
bindSlider("high-gain", "o-high", "highGain");

$<HTMLButtonElement>("test-btn").addEventListener("click", async () => {
  const ok = await gamepad.test();
  if (!ok) $<HTMLElement>("hint").textContent = "找不到可震動的手把 — 連接手把後按一下任意鍵再試。";
});

// ---- Render loop ----
function tick(ts: number): void {
  const active = !video.paused && !video.ended && video.readyState >= 2;

  // Always read audio so the onset detector's running state stays current;
  // the engine zeroes it out when the audio source is disabled.
  const a = audioAnalyser.read();
  const m = active ? motionAnalyser.read() : { intensity: 0, vertical: 0 };

  // Scene: either forced by the user or auto-detected.
  const detected = classifier.push(a, m);
  const scene: Scene = settings.sceneMode === "auto" ? detected : (settings.sceneMode as Scene);
  sceneLabel.textContent = SCENE_LABEL[settings.useScene ? scene : "idle"];

  const target = active
    ? engine.compute(a, m, scene, settings)
    : engine.compute(
        { low: 0, mid: 0, high: 0, rms: 0, transient: 0 },
        { intensity: 0, vertical: 0 },
        "idle",
        settings,
      );

  mStrong.style.width = `${Math.round(target.strong * 100)}%`;
  mWeak.style.width = `${Math.round(target.weak * 100)}%`;
  mMotion.style.width = `${Math.round(m.intensity * 100)}%`;

  gamepad.update(target.strong, target.weak, ts);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
