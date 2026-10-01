import { Input, matchesKey, truncateToWidth, visibleWidth, sliceByColumn } from "@earendil-works/pi-tui";
import { getSupportedThinkingLevels, type Model } from "@earendil-works/pi-ai";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { filterModels, modelKey, moveIndex } from "./state.ts";

export function ink(theme: Theme, role: "pink" | "cyan" | "purple" | "yellow", text: string): string {
  if (process.env.NO_COLOR) return text;
  const palettes = theme.name === "light"
    ? { pink: [164,46,103], cyan: [0,127,153], purple: [118,65,176], yellow: [138,100,0] }
    : { pink: [252,112,180], cyan: [64,226,255], purple: [185,103,255], yellow: [255,211,47] };
  return `\x1b[38;2;${palettes[role].join(";")}m${text}\x1b[39m`;
}

export const number = (value: number) => value < 1000 ? `${Math.round(value)}`
  : value < 1_000_000 ? `${(value / 1000).toFixed(1)}k` : `${(value / 1_000_000).toFixed(1)}M`;

export function middle(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;
  if (width < 3) return truncateToWidth(text, Math.max(0, width));
  const tail = Math.floor((width - 1) / 2);
  return sliceByColumn(text, 0, width - 1 - tail, true) + "…"
    + sliceByColumn(text, visibleWidth(text) - tail, tail, true);
}

type Tab = "Model" | "Thinking" | "Display";
export type Choice = { model: Model<any> } | { thinking: string } | { expanded: boolean };

export class CandyPanel {
  private input = new Input({ prompt: "Search › ", placeholder: "Name, provider, or model ID" });
  private tab: Tab = "Model";
  private selected = 0;
  private thinking = 0;
  private display = 0;
  private error = "";
  private busy = false;
  private disposed = false;
  private focus = false;
  private readonly levels: string[];
  private models: Model<any>[];
  constructor(private options: {
    models: Model<any>[]; current?: Model<any>; thinking: string; expanded: boolean;
    theme: Theme; rows: () => number; render: () => void;
    apply: (choice: Choice) => Promise<void>; done: () => void;
  }) {
    this.models = options.models;
    this.selected = Math.max(0, this.models.findIndex((m) => options.current && modelKey(m) === modelKey(options.current)));
    this.levels = options.current ? getSupportedThinkingLevels(options.current) : ["off"];
    this.thinking = Math.max(0, this.levels.indexOf(options.thinking));
    this.display = options.expanded ? 1 : 0;
  }
  get focused(): boolean { return this.focus; }
  set focused(value: boolean) { this.focus = value; this.input.focused = value && this.tab === "Model"; }
  invalidate(): void { this.input.invalidate(); }
  dispose(): void { this.disposed = true; }
  private matches(): Model<any>[] { return filterModels(this.models, this.input.getValue()); }
  private async apply(): Promise<void> {
    let choice: Choice;
    if (this.tab === "Model") {
      const model = this.matches()[this.selected];
      if (!model) return;
      choice = { model };
    } else if (this.tab === "Thinking") choice = { thinking: this.levels[this.thinking] };
    else choice = { expanded: this.display === 1 };
    this.busy = true; this.error = ""; this.options.render();
    try {
      await this.options.apply(choice);
      if (!this.disposed) this.options.done();
    } catch (error) {
      if (!this.disposed) this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      if (!this.disposed) this.options.render();
    }
  }
  handleInput(data: string): void {
    if (this.busy) return;
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) return this.options.done();
    if (matchesKey(data, "tab") || matchesKey(data, "shift+tab")) {
      const tabs: Tab[] = ["Model", "Thinking", "Display"];
      this.tab = tabs[moveIndex(tabs.indexOf(this.tab), matchesKey(data, "shift+tab") ? -1 : 1, tabs.length)];
      this.input.focused = this.focus && this.tab === "Model";
      this.error = "";
    } else if (matchesKey(data, "enter")) { void this.apply(); return; }
    else if (matchesKey(data, "up") || matchesKey(data, "down") ||
      (this.tab !== "Model" && (matchesKey(data, "left") || matchesKey(data, "right")))) {
      const delta = matchesKey(data, "up") || matchesKey(data, "left") ? -1 : 1;
      if (this.tab === "Model") this.selected = moveIndex(this.selected, delta, this.matches().length);
      else if (this.tab === "Thinking") this.thinking = moveIndex(this.thinking, delta, this.levels.length);
      else this.display = moveIndex(this.display, delta, 2);
    } else if (this.tab === "Model") {
      const before = this.input.getValue();
      this.input.handleInput(data);
      if (before !== this.input.getValue()) { this.selected = 0; this.error = ""; }
    }
    this.options.render();
  }
  render(width: number): string[] {
    if (width < 1) return [];
    const { theme } = this.options;
    const dim = (text: string) => process.env.NO_COLOR ? text : theme.fg("dim", text);
    const selected = (text: string) => ink(theme, "cyan", text);
    const rows = Math.max(5, Math.floor(this.options.rows() * 0.8));
    const lines = [ink(theme, "pink", "woshahua") + dim("  /  controls"),
      (["Model", "Thinking", "Display"] as Tab[]).map((tab) => tab === this.tab ? selected(`› ${tab}`) : dim(`  ${tab}`)).join("   ")];
    if (this.tab === "Model") {
      lines.push(...this.input.render(width));
      const models = this.matches();
      const count = Math.max(1, Math.min(6, rows - 9));
      const start = Math.max(0, Math.min(this.selected - Math.floor(count / 2), models.length - count));
      if (!models.length) lines.push(dim("No matching models. Change the search or use /login."));
      for (let i = start; i < Math.min(models.length, start + count); i++) {
        const m = models[i];
        const current = this.options.current && modelKey(m) === modelKey(this.options.current);
        const label = `${i === this.selected ? "›" : " "} ${m.name}  ${current ? "● " : ""}${m.provider}`;
        lines.push(i === this.selected ? selected(label) : dim(label));
      }
      const m = models[this.selected];
      if (m && rows >= 12) {
        lines.push(dim(`${this.selected + 1}/${models.length}  ${m.provider}/${m.id}`));
        lines.push(dim(`Context ${number(m.contextWindow)} · Output ${number(m.maxTokens)} · ${m.reasoning ? "Reasoning" : "No reasoning"}`));
      }
    } else if (this.tab === "Thinking") {
      lines.push(dim(this.options.current?.name ?? "No model selected"));
      const count = Math.max(1, rows - 5);
      const start = Math.max(0, Math.min(this.thinking - Math.floor(count / 2), this.levels.length - count));
      for (let i = start; i < Math.min(this.levels.length, start + count); i++) {
        const label = `${i === this.thinking ? "›" : " "} ${this.levels[i]}${this.levels[i] === this.options.thinking ? " ●" : ""}`;
        lines.push(i === this.thinking ? selected(label) : dim(label));
      }
    } else {
      lines.push(dim("Tool output"));
      lines.push(this.display === 0 ? selected("› Compact previews") : dim("  Compact previews"));
      lines.push(this.display === 1 ? selected("› Expanded output") : dim("  Expanded output"));
    }
    const hint = this.busy ? "Applying…" : this.error || (width >= 65 ? "<Tab> section  <↑↓> choose  <Enter> apply  <Esc> back" : "<Tab>  <Enter>  <Esc>");
    // Keep controls visible when a terminal is resized while the panel is open.
    return [...lines.slice(0, rows - 2), dim("Changes apply to this session only."),
      ink(theme, this.error ? "yellow" : "cyan", hint)].map((line) => truncateToWidth(line, width));
  }
}
