const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function panelGeometry(progress: number, height: number): { rows: number; topReveal: number } {
  const count = Math.max(1, height);
  const growth = clamp((progress - 0.12) / 0.55);
  return {
    rows: Math.min(count, Math.max(1, Math.round(Math.min(2, count) + Math.max(0, count - 2) * growth))),
    topReveal: progress < 0.12 ? 1 - progress / 0.12 : clamp((progress - 0.65) / 0.08),
  };
}

export const panelRowVisible = (progress: number, row: number, height: number) =>
  progress >= 0.73 + row / Math.max(1, height) * 0.25;

/** Fold the frame first, then reveal its content. Stop the clock at either endpoint. */
export class PanelMotion {
  private from = 0;
  private target = 0;
  private started = 0;
  private duration = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private complete?: () => void;
  private disposed = false;
  private request: () => void;
  private animated: boolean;
  constructor(request: () => void, animated = true) { this.request = request; this.animated = animated; }
  value(): number {
    if (!this.duration) return this.target;
    const p = clamp((Date.now() - this.started) / this.duration);
    return this.from + (this.target - this.from) * p * p * (3 - 2 * p);
  }
  open(): void { this.transition(1); }
  close(complete: () => void): void { this.transition(0, complete); }
  private transition(target: number, complete?: () => void): void {
    if (this.disposed) return;
    this.from = this.value(); this.target = target; this.started = Date.now(); this.complete = complete;
    this.duration = this.animated ? Math.abs(target - this.from) * (target ? 800 : 560) : 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.duration) { this.finish(); return; }
    this.request(); this.schedule();
  }
  private schedule(): void {
    if (this.disposed || this.timer || !this.duration) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.disposed) return;
      if (Date.now() - this.started >= this.duration) this.finish();
      else { this.request(); this.schedule(); }
    }, Math.min(40, Math.max(1, this.duration - (Date.now() - this.started))));
    this.timer.unref?.();
  }
  private finish(): void {
    this.duration = 0;
    const complete = this.complete; this.complete = undefined;
    complete?.();
    if (!this.disposed) this.request();
  }
  dispose(): void {
    this.disposed = true; this.complete = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
