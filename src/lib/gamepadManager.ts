/**
 * Wraps the Web Gamepad API's vibration actuator. Standard gamepads (Xbox and
 * most PC controllers) expose a "dual-rumble" actuator with a strong (low-freq)
 * and weak (high-freq) motor. playEffect() effects queue and can't be spammed
 * every frame, so we throttle updates and use an effect duration slightly longer
 * than the update interval to avoid audible gaps.
 */

type Actuator = {
  playEffect(type: string, params: Record<string, number>): Promise<string>;
  reset?(): Promise<string>;
};

export class GamepadManager {
  private index: number | null = null;
  private lastSent = 0;
  private readonly updateMs = 60;
  private readonly effectMs = 120;
  onStatusChange?: (connected: boolean, id: string | null) => void;

  start(): void {
    window.addEventListener("gamepadconnected", this.onConnect);
    window.addEventListener("gamepaddisconnected", this.onDisconnect);
    // Pick up a pad that connected before we attached listeners.
    this.rescan();
  }

  stop(): void {
    window.removeEventListener("gamepadconnected", this.onConnect);
    window.removeEventListener("gamepaddisconnected", this.onDisconnect);
  }

  get connected(): boolean {
    return this.index !== null && this.getPad() !== null;
  }

  private onConnect = (e: GamepadEvent): void => {
    this.index = e.gamepad.index;
    this.onStatusChange?.(true, e.gamepad.id);
  };

  private onDisconnect = (e: GamepadEvent): void => {
    if (e.gamepad.index === this.index) {
      this.index = null;
      this.onStatusChange?.(false, null);
    }
  };

  private rescan(): void {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (p) {
        this.index = p.index;
        this.onStatusChange?.(true, p.id);
        return;
      }
    }
  }

  private getPad(): Gamepad | null {
    if (this.index === null) return null;
    const pads = navigator.getGamepads?.() ?? [];
    return pads[this.index] ?? null;
  }

  private getActuator(pad: Gamepad): Actuator | null {
    // Standard: gamepad.vibrationActuator (dual-rumble).
    const va = (pad as unknown as { vibrationActuator?: Actuator }).vibrationActuator;
    if (va && typeof va.playEffect === "function") return va;
    // Legacy Firefox: hapticActuators[].pulse — not dual-rumble, best effort skip.
    return null;
  }

  /** timestamp is performance.now() from the render loop (throttling clock). */
  update(strong: number, weak: number, timestamp: number): void {
    if (timestamp - this.lastSent < this.updateMs) return;
    const pad = this.getPad();
    if (!pad) return;
    const act = this.getActuator(pad);
    if (!act) return;
    this.lastSent = timestamp;
    void act
      .playEffect("dual-rumble", {
        startDelay: 0,
        duration: this.effectMs,
        strongMagnitude: clamp01(strong),
        weakMagnitude: clamp01(weak),
      })
      .catch(() => {
        /* effect can be interrupted; ignore */
      });
  }

  /** One-off buzz for the "test" button. */
  async test(): Promise<boolean> {
    const pad = this.getPad();
    if (!pad) return false;
    const act = this.getActuator(pad);
    if (!act) return false;
    await act.playEffect("dual-rumble", {
      startDelay: 0,
      duration: 400,
      strongMagnitude: 0.8,
      weakMagnitude: 0.6,
    });
    return true;
  }

  stopRumble(): void {
    const pad = this.getPad();
    if (!pad) return;
    const act = this.getActuator(pad);
    void act?.reset?.().catch(() => {});
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
