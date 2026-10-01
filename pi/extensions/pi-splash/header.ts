import { SPRITE, SPRITE_PALETTE } from "./sprite.generated.ts";

export const DURATION_MS = 1200;
const FRAME_MS = 32;

export type Ink = "accent" | "highlight" | "text" | "dim";
interface Options {
  paint: (ink: Ink, text: string) => string;
  requestRender: () => void;
  animate?: boolean;
  color?: boolean;
  getAvailableHeight?: () => number;
}

function ease(value: number): number {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
}

function spriteCell(top: number, bottom: number, shine: number, color: boolean): string {
  if (top < 0 && bottom < 0) return " ";
  const glyph = top < 0 ? "▄" : bottom < 0 || top !== bottom ? "▀" : "█";
  if (!color) return glyph;
  const rgb = (index: number) => SPRITE_PALETTE[index].map((channel) =>
    Math.round(channel + (255 - channel) * shine)).join(";");
  const foreground = `\x1b[38;2;${rgb(top < 0 ? bottom : top)}m`;
  const background = top >= 0 && bottom >= 0 && top !== bottom ? `\x1b[48;2;${rgb(bottom)}m` : "";
  return `${foreground}${background}${glyph}\x1b[0m`;
}

/** A finite startup animation. The component never reads input or moves the cursor. */
export class SplashHeader {
  private readonly options: Options;
  private started: number | undefined;
  private settled: boolean;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: Options) {
    this.options = options;
    this.settled = options.animate === false;
  }

  private schedule(): void {
    if (this.timer || this.settled || this.disposed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (Date.now() - this.started! >= DURATION_MS) this.settled = true;
      this.options.requestRender();
      this.schedule();
    }, FRAME_MS);
    this.timer.unref?.();
  }

  finish(): void {
    this.settled = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.disposed) this.options.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    this.settled = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  invalidate(): void {}

  render(width: number): string[] {
    width = Math.max(0, Math.floor(width));
    if (width === 0) return [];
    if (this.started === undefined && !this.settled) {
      this.started = Date.now();
      this.schedule();
    }
    const p = this.settled ? 1 : Math.min(1, (Date.now() - this.started!) / DURATION_MS);
    const paint = this.options.paint;
    const availableHeight = Math.max(2, this.options.getAvailableHeight?.() ?? 22);
    if (width < 32 || availableHeight < 9) {
      const text = "woshahua · ready when you are".slice(0, width);
      return [paint("accent", text), ""];
    }

    const columns = Math.min(SPRITE[0].length, width);
    const scale = Math.min(1, columns / SPRITE[0].length, ((availableHeight - 3) * 2) / SPRITE.length);
    const pixelRows = Math.max(2, Math.floor(SPRITE.length * scale / 2) * 2);
    const pixelColumns = Math.max(1, Math.floor(SPRITE[0].length * pixelRows / SPRITE.length));
    const height = pixelRows / 2 + 2;
    const left = " ".repeat(Math.floor((width - columns) / 2));
    const grid = Array.from({ length: height }, () => Array<string>(columns).fill(" "));
    const inks = Array.from({ length: height }, () => Array<Ink | undefined>(columns).fill(undefined));
    const logoLeft = Math.floor((columns - pixelColumns) / 2);
    const radius = pixelColumns / 2 + pixelRows * 0.3;
    const reveal = ease(p / 0.6) * (radius + 1);
    const sweep = ((p - 0.4) / 0.6) * (pixelColumns + pixelRows * 0.35 + 8) - 4;
    const sample = (x: number, y: number): number => {
      const sx = Math.min(SPRITE[0].length - 1, Math.floor((x + 0.5) / pixelColumns * SPRITE[0].length));
      const sy = Math.min(SPRITE.length - 1, Math.floor((y + 0.5) / pixelRows * SPRITE.length));
      const value = SPRITE[sy][sx];
      return value === "." ? -1 : parseInt(value, 36);
    };
    for (let y = 0; y < pixelRows; y += 2) {
      for (let x = 0; x < pixelColumns; x++) {
        const distance = Math.abs(x - (pixelColumns - 1) / 2) + y * 0.3;
        if (p < 1 && distance > reveal) continue;
        const row = y / 2;
        const col = logoLeft + x;
        const shine = p > 0.4 && p < 1 ? Math.max(0, 1 - Math.abs(x + y * 0.35 - sweep) / 2.5) : 0;
        grid[row][col] = spriteCell(sample(x, y), sample(x, y + 1), shine * 0.8, this.options.color !== false);
        inks[row][col] = undefined;
      }
    }

    const tagline = "woshahua · ready when you are";
    const taglineLeft = Math.floor((columns - tagline.length) / 2);
    const shown = Math.floor(ease((p - 0.35) / 0.4) * tagline.length);
    for (let x = 0; x < shown; x++) {
      grid[height - 1][taglineLeft + x] = tagline[x];
      inks[height - 1][taglineLeft + x] = "text";
    }
    return [...grid.map((row, y) => left + row.map((char, x) =>
      char === " " || inks[y][x] === undefined ? char : paint(inks[y][x]!, char)).join("")), ""];
  }
}
