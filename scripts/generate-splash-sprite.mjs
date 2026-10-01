// Read the pixel SVG as vector cells. Keep its colors and pixel grid intact.
import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../assets/woshahua-wordmark-dot.svg", import.meta.url);
const target = new URL("../pi/extensions/pi-splash/sprite.generated.ts", import.meta.url);
const svg = readFileSync(source, "utf8");
const bounds = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
if (!bounds) throw new Error("Expected a pixel SVG with integer bounds");
const [, width, height] = bounds.map(Number);
const grid = Array.from({ length: height }, () => Array(width).fill("."));
const palette = [];
let minX = width, minY = height, maxX = -1, maxY = -1;
for (const [, hex, path] of svg.matchAll(/<path fill="#([\da-f]{6})" d="([^"]+)"\/>/gi)) {
  const index = palette.length;
  if (index >= 36) throw new Error("The sprite supports at most 36 colors");
  palette.push([0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)));
  const cells = [...path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
  if (cells.map((cell) => cell[0]).join("") !== path) throw new Error("Unsupported pixel path");
  for (const [, sx, sy, span, back] of cells) {
    const x = Number(sx), y = Number(sy), count = Number(span);
    if (span !== back || count < 1 || x + count > width || y >= height) throw new Error("Invalid pixel run");
    for (let dx = 0; dx < count; dx++) grid[y][x + dx] = index.toString(36);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x + count - 1);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
}
if (maxX < 0) throw new Error("The source SVG is empty");
// Remove empty margins and keep an even height for terminal half-block cells.
const sprite = grid.slice(minY, maxY + 1).map((row) => row.slice(minX, maxX + 1).join(""));
if (sprite.length % 2) sprite.push(".".repeat(sprite[0].length));
writeFileSync(target, `// Generated from assets/woshahua-wordmark-dot.svg. Run scripts/generate-splash-sprite.mjs.\n`
  + `export const SPRITE_PALETTE: readonly (readonly number[])[] = ${JSON.stringify(palette)};\n`
  + `export const SPRITE = ${JSON.stringify(sprite, null, 2)};\n`);
console.log(`Generated ${sprite[0].length}x${sprite.length} sprite with ${palette.length} colors`);
