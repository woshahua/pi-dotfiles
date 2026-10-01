export interface MotionState {
  mode: string; thinking: string; busy: boolean; failed: boolean; light: boolean;
}
type RGB = readonly number[];
const mix = (a: RGB, b: RGB, value: number) => a.map((v, i) => Math.round(v + (b[i] - v) * value));
const smooth = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };

/** One clock owns the entrance, state transitions, and activity trail. */
export class FrameMotion {
  private request: () => void;
  private animated: boolean;
  private color: boolean;
  private state?: MotionState;
  private entered = 0;
  private changed = -Infinity;
  private pulse = -Infinity;
  private from: RGB = [185, 103, 255];
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(request: () => void, animated = true, color = true) {
    this.request = request; this.animated = animated; this.color = color;
  }
  update(next: MotionState): void {
    const now = Date.now();
    if (!this.state) this.entered = now;
    else {
      if (next.mode !== this.state.mode || next.light !== this.state.light || next.failed !== this.state.failed) {
        this.from = this.base(now); this.changed = now;
      }
      if (next.thinking !== this.state.thinking) this.pulse = now;
    }
    this.state = next; this.schedule();
  }
  private target(): RGB {
    const s = this.state!;
    if (s.failed) return s.light ? [183,47,84] : [242,93,131];
    if (s.mode.startsWith("Shell")) return s.light ? [138,100,0] : [255,211,47];
    if (s.mode === "Command") return s.light ? [0,127,153] : [64,226,255];
    return s.light ? [118,65,176] : [185,103,255];
  }
  private base(now: number): RGB {
    return mix(this.from, this.target(), this.animated ? smooth((now - this.changed) / 360) : 1);
  }
  private moving(): boolean {
    const now = Date.now();
    return this.animated && !!this.state && (this.state.busy || now - this.entered < 520 || now - this.changed < 360 || now - this.pulse < 900);
  }
  private schedule(): void {
    if (this.timer || this.disposed || !this.moving()) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.disposed) return;
      this.request(); this.schedule();
    }, 40);
    this.timer.unref?.();
  }
  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
  paint(text: string, start: number, row: number, width: number, rows: number): string {
    if (!this.state || !this.color) return text;
    const now = Date.now();
    const perimeter = Math.max(1, 2 * (width - 1) + 2 * (rows - 1));
    const position = (x: number) => row === 0 ? x : x === width - 1 ? width - 1 + row
      : row === rows - 1 ? width - 1 + rows - 1 + width - 1 - x : perimeter - row;
    const origin = width - 1 + rows - 1 + (width - 1) / 2;
    const entrance = this.animated ? smooth((now - this.entered) / 520) : 1;
    const level = Math.max(0, ["off","minimal","low","medium","high","xhigh","max"].indexOf(this.state.thinking));
    const cyan: RGB = this.state.light ? [0,127,153] : [64,226,255];
    const pink: RGB = this.state.light ? [164,46,103] : [252,112,180];
    const head = ((now - this.entered) / (90 - level * 5)) % perimeter;
    let column = start;
    return [...text].map((char) => {
      const index = position(column++);
      const distance = Math.min(Math.abs(index - origin), perimeter - Math.abs(index - origin));
      if (entrance < 1 && distance > entrance * (perimeter / 2 + 2)) return " ";
      let rgb = mix(this.base(now), pink, 0.25 + Math.sin(index / perimeter * Math.PI * 2) * 0.2);
      let glow = 0;
      if (this.animated && this.state.busy) {
        const trail = (head - index + perimeter) % perimeter;
        glow = Math.max(0, 1 - trail / (8 + level * 2));
        glow = Math.max(glow, 0.12 + 0.1 * Math.sin(now / 700));
      }
      if (this.animated && now - this.pulse < 900) {
        const front = (now - this.pulse) / 900;
        glow = Math.max(glow, Math.max(0, 1 - Math.abs(distance / (perimeter / 2) - front) / 0.16));
      }
      rgb = mix(rgb, cyan, glow);
      return `\x1b[38;2;${rgb.join(";")}m${char}\x1b[39m`;
    }).join("");
  }
}
