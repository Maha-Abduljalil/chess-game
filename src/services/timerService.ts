export type TimerColor = "white" | "black";

export interface TimerState {
  white: number;
  black: number;
}

export interface TimerConfig {
  initialMs?: number;
  incrementMs?: number;
}

export class ChessTimer {
  private times: TimerState;
  readonly incrementMs: number;

  private activeColor: TimerColor | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private timeoutFired = false;
  private hiddenPaused = false;

  private onTickCb?: (state: TimerState) => void;
  private onTimeoutCb?: (loser: TimerColor) => void;

  constructor(config: TimerConfig = {}) {
    const initialMs = config.initialMs ?? 600_000;
    this.incrementMs = config.incrementMs ?? 0;
    this.times = { white: initialMs, black: initialMs };
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.intervalId !== null) {
        this.drainElapsed();
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.hiddenPaused = true;
      }
    } else if (this.hiddenPaused && this.activeColor !== null) {
      this.hiddenPaused = false;
      this.lastTick = Date.now();
      this.intervalId = setInterval(() => this.tick(), 100);
    }
  };


  restoreFromSnapshot(
    savedTimes: TimerState,
    timerStartedAt: number,
    activeTurn: TimerColor | null
  ): void {
    this.stopInternal();
    this.timeoutFired = false;
    this.hiddenPaused = false;

    if (activeTurn !== null && timerStartedAt > 0) {
      const drift = Math.max(0, Date.now() - timerStartedAt);
      this.times = {
        white: Math.max(0, savedTimes.white - (activeTurn === "white" ? drift : 0)),
        black: Math.max(0, savedTimes.black - (activeTurn === "black" ? drift : 0)),
      };
    } else {
      this.times = { ...savedTimes };
    }
  }

  start(color: TimerColor): void {
    this.stopInternal();
    this.timeoutFired = false;
    this.hiddenPaused = false;
    this.activeColor = color;
    this.lastTick = Date.now();
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  pause(): void {
    this.drainElapsed();
    this.stopInternal();
  }


  switchAfterMove(movedColor: TimerColor, nextColor: TimerColor): TimerState {
    this.drainElapsed();
    this.stopInternal();

    if (this.incrementMs > 0) {
      this.times[movedColor] += this.incrementMs;
    }

    this.activeColor = nextColor;
    this.lastTick = Date.now();
    this.hiddenPaused = false;
    this.intervalId = setInterval(() => this.tick(), 100);

    return { ...this.times };
  }

  getState(): TimerState { return { ...this.times }; }
  getActiveColor(): TimerColor | null { return this.activeColor; }

  onTick(cb: (state: TimerState) => void): void { this.onTickCb = cb; }
  onTimeout(cb: (loser: TimerColor) => void): void { this.onTimeoutCb = cb; }

  destroy(): void {
    this.stopInternal();
    this.onTickCb = undefined;
    this.onTimeoutCb = undefined;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  private tick(): void {
    if (!this.activeColor) return;
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;

    this.times[this.activeColor] = Math.max(0, this.times[this.activeColor] - elapsed);
    this.onTickCb?.({ ...this.times });

    if (this.times[this.activeColor] <= 0 && !this.timeoutFired) {
      this.timeoutFired = true;
      const loser = this.activeColor;
      this.stopInternal();
      this.onTimeoutCb?.(loser);
    }
  }

  private drainElapsed(): void {
    if (this.activeColor !== null && this.lastTick > 0) {
      const now = Date.now();
      this.times[this.activeColor] = Math.max(
        0,
        this.times[this.activeColor] - (now - this.lastTick)
      );
      this.lastTick = now;
    }
  }

  private stopInternal(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeColor = null;
  }
}
