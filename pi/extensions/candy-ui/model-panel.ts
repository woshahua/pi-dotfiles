import { ModelSelectorComponent } from "@earendil-works/pi-coding-agent";
import { CURSOR_MARKER, getKeybindings, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { PanelMotion, panelGeometry, panelRowVisible } from "./panel-motion.ts";

interface Frame { motion: PanelMotion; closing: boolean; disposed: boolean }

export function renderModelFrame(content: string[], width: number, progress: number, light: boolean): string[] {
  const inner = Math.max(0, width - 4);
  const { rows, topReveal } = panelGeometry(progress, content.length);
  const paint = (text: string, row: number) => {
    if (process.env.NO_COLOR) return text;
    const pink = light ? [164,46,103] : [252,112,180];
    const purple = light ? [118,65,176] : [185,103,255];
    const color = purple.map((v, i) => Math.round(v + (pink[i] - v) * row / (rows + 1)));
    return `\x1b[38;2;${color.join(";")}m${text}\x1b[39m`;
  };
  const half = Math.min(Math.floor((width - 2) / 2), Math.ceil((width - 2) / 2 * topReveal));
  const top = topReveal === 1 ? "─".repeat(width - 2)
    : "─".repeat(half) + " ".repeat(width - 2 - 2 * half) + "─".repeat(half);
  const result = [paint(`╭${top}╮`, 0)];
  for (let row = 0; row < rows; row++) {
    const text = panelRowVisible(progress, row, content.length) ? truncateToWidth(content[row] ?? "", inner, "") : "";
    result.push(paint("│ ", row + 1) + text + " ".repeat(Math.max(0, inner - visibleWidth(text))) + paint(" │", row + 1));
  }
  // Keep the input method anchored even before its search row becomes visible.
  if (content.join("").includes(CURSOR_MARKER) && !result.join("").includes(CURSOR_MARKER)) {
    result[1] = result[1].replace("│ ", "│ " + CURSOR_MARKER);
  }
  result.push(paint(`╰${"─".repeat(width - 2)}╯`, rows + 1));
  return result;
}

/** Decorate the exported selector so native commands, bindings and model persistence keep ownership. */
export function animateModelSelectors(request: () => void, light: () => boolean,
  animated = process.env.PI_CANDY_ANIMATIONS !== "0" && !process.env.NO_COLOR): () => void {
  const proto = ModelSelectorComponent.prototype;
  const originals = { render: proto.render, handleInput: proto.handleInput, dispose: proto.dispose };
  const descriptors = new Map(Object.keys(originals).map((name) => [name, Object.getOwnPropertyDescriptor(proto, name)]));
  const frames = new WeakMap<ModelSelectorComponent, Frame>();
  const live = new Set<Frame>();
  let stopped = false;
  const frameFor = (component: ModelSelectorComponent) => {
    let frame = frames.get(component);
    if (!frame) {
      frame = { motion: new PanelMotion(request, animated), closing: false, disposed: false };
      frames.set(component, frame); live.add(frame); frame.motion.open();
    }
    return frame;
  };
  const render = function (this: ModelSelectorComponent, width: number): string[] {
    if (stopped || width < 6) return originals.render.call(this, width);
    const frame = frameFor(this);
    const inner = width - 4;
    // Replace the native rules, while retaining every content row and its native IME marker.
    const content = originals.render.call(this, inner).slice(1, -1);
    return renderModelFrame(content, width, frame.motion.value(), light());
  };
  const handleInput = function (this: ModelSelectorComponent, data: string): void {
    if (stopped) { originals.handleInput.call(this, data); return; }
    const frame = frameFor(this);
    if (frame.closing || frame.disposed) return;
    if (getKeybindings().matches(data, "tui.select.cancel")) {
      frame.closing = true;
      frame.motion.close(() => {
        if (stopped || frame.disposed) return;
        frame.closing = false;
        originals.handleInput.call(this, data);
        if (!frame.disposed) frame.motion.open();
      });
    } else {
      // Apply selection immediately: a catalog refresh must not change it during an exit animation.
      originals.handleInput.call(this, data);
    }
  };
  const dispose = function (this: ModelSelectorComponent): void {
    const frame = frames.get(this);
    if (frame) { frame.disposed = true; frame.motion.dispose(); live.delete(frame); }
    originals.dispose.call(this);
  };
  const replacements = { render, handleInput, dispose };
  Object.assign(proto, replacements);
  return () => {
    stopped = true;
    for (const frame of live) frame.motion.dispose();
    live.clear();
    for (const name of Object.keys(replacements) as (keyof typeof replacements)[]) {
      // Another extension may have installed a later wrapper; do not remove it.
      if (proto[name] !== replacements[name]) continue;
      const descriptor = descriptors.get(name);
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else Reflect.deleteProperty(proto, name);
    }
  };
}
