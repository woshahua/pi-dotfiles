import { stripVTControlCharacters } from "node:util";
import { CustomEditor, type ExtensionContext, type EditorFactory } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type EditorComponent } from "@earendil-works/pi-tui";
import { FrameMotion, type MotionState } from "./motion.ts";

export interface EditorState { thinking: string; busy: boolean; failed: boolean; label: string }
export function inputMode(text: string): string {
  return text.startsWith("!!") ? "Shell · No Context" : text.startsWith("!") ? "Shell"
    : text.startsWith("/") ? "Command" : "Chat";
}

/** Decorate the existing instance so its paste closures and key handlers keep ownership. */
export function decorateEditor(editor: EditorComponent, request: () => void,
  getState: () => EditorState, light: () => boolean, animated = true, color = true): () => void {
  const motion = new FrameMotion(request, animated, color);
  const render = editor.render.bind(editor);
  const padding = editor.setPaddingX?.bind(editor);
  if (padding) {
    editor.setPaddingX = (value) => padding(Math.max(2, value));
    editor.setPaddingX(2);
  }
  editor.render = (width) => {
    const lines = render(width);
    if (width < 6 || lines.length < 3) return lines;
    // Autocomplete follows the bottom rule. Do not decorate or shift its rows.
    const bottom = lines.findIndex((line, i) => i >= 2 && /^[─━]/.test(stripVTControlCharacters(line)));
    if (bottom < 0) return lines;
    const state = getState();
    const mode = inputMode(editor.getText());
    const snapshot: MotionState = { ...state, mode, light: light() };
    motion.update(snapshot);
    const rows = bottom + 1;
    const rule = (top: boolean, old: string) => {
      const overflow = stripVTControlCharacters(old).match(/[↑↓]\s*\d+[^─━]*/)?.[0]?.trim();
      const label = top ? [mode, state.busy ? state.label : state.failed ? "Check errors" : "", overflow].filter(Boolean).join(" · ")
        : [state.thinking, overflow].filter(Boolean).join(" · ");
      const caption = truncateToWidth(` ${label} `, width - 4, "");
      const text = `${top ? "╭" : "╰"}─${caption}${"─".repeat(Math.max(0, width - 3 - visibleWidth(caption)))}${top ? "╮" : "╯"}`;
      // Captions are kept readable even while the decorative stroke enters.
      const left = motion.paint(text.slice(0, 2), 0, top ? 0 : bottom, width, rows);
      const right = motion.paint("─".repeat(Math.max(0, width - 3 - visibleWidth(caption))) + (top ? "╮" : "╯"),
        2 + visibleWidth(caption), top ? 0 : bottom, width, rows);
      return left + caption + right;
    };
    lines[0] = rule(true, lines[0]);
    lines[bottom] = rule(false, lines[bottom]);
    if (padding) for (let y = 1; y < bottom; y++) {
      lines[y] = lines[y].replace(/^ /, motion.paint("│", 0, y, width, rows))
        .replace(/ $/, motion.paint("│", width - 1, y, width, rows));
    }
    return lines;
  };
  return () => motion.dispose();
}

/** Follow the public editor factory without taking over another extension's input logic. */
export class EditorFrame {
  private context: ExtensionContext;
  private state: () => EditorState;
  private wrapped?: EditorFactory;
  private previous?: EditorFactory;
  private pending?: ReturnType<typeof setTimeout>;
  private stop?: () => void;
  private disposed = false;
  constructor(context: ExtensionContext, state: () => EditorState) { this.context = context; this.state = state; }
  ensure(): void {
    if (this.disposed || this.pending || (this.wrapped && this.context.ui.getEditorComponent() === this.wrapped)) return;
    this.pending = setTimeout(() => { this.pending = undefined; this.attach(); }, 0);
  }
  private attach(): void {
    if (this.disposed) return;
    const ui = this.context.ui;
    const current = ui.getEditorComponent();
    if (current === this.wrapped && this.wrapped) return;
    this.stop?.();
    this.previous = current;
    this.wrapped = (tui, theme, keys) => {
      this.stop?.();
      const editor = current?.(tui, theme, keys) ?? new CustomEditor(tui, theme, keys);
      this.stop = decorateEditor(editor, () => {
        // Pi does not dispose old editor instances when replacing their factory.
        if (this.disposed || ui.getEditorComponent() !== this.wrapped) { this.stop?.(); return; }
        tui.requestRender();
      }, this.state, () => ui.theme.name === "light", process.env.PI_CANDY_ANIMATIONS !== "0" && !process.env.NO_COLOR, !process.env.NO_COLOR);
      return editor;
    };
    ui.setEditorComponent(this.wrapped);
  }
  dispose(restore = false): void {
    this.disposed = true;
    if (this.pending) clearTimeout(this.pending);
    this.stop?.();
    if (restore && this.wrapped && this.context.ui.getEditorComponent() === this.wrapped) this.context.ui.setEditorComponent(this.previous);
  }
}
