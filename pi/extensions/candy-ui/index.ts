import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { EditorFrame } from "./editor.ts";
import { animateModelSelectors } from "./model-panel.ts";
import { Activity, selectModels } from "./state.ts";
import { CandyPanel, ink, number, middle } from "./ui.ts";

export default function candyUI(pi: ExtensionAPI): void {
  let ctx: ExtensionContext | undefined;
  let activity = new Activity();
  let repaint = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  let closePanel: (() => void) | undefined;
  let enabled = true;
  let input = 0, output = 0, cost = 0;
  let generation = 0;
  let editorFrame: EditorFrame | undefined;
  let restoreModels: (() => void) | undefined;

  const stopTimer = () => { if (timer) clearInterval(timer); timer = undefined; };
  const refresh = (next: ExtensionContext) => { ctx = next; repaint(); };
  const totals = () => {
    input = 0; output = 0; cost = 0;
    for (const entry of ctx?.sessionManager.getBranch() ?? []) {
      if (entry.type === "message" && entry.message.role === "assistant") {
        const usage = entry.message.usage;
        input += usage.input + usage.cacheRead + usage.cacheWrite;
        output += usage.output; cost += usage.cost.total;
      }
    }
  };
  const mount = (context: ExtensionContext) => {
    if (context.mode !== "tui") return;
    restoreModels?.();
    restoreModels = animateModelSelectors(() => repaint(), () => context.ui.theme.name === "light");
    editorFrame?.dispose(true);
    editorFrame = new EditorFrame(context, () => ({
      thinking: ctx?.model?.reasoning ? pi.getThinkingLevel() : "off",
      busy: activity.active || activity.compacting, failed: activity.failed,
      label: activity.label(),
    }));
    editorFrame.ensure();
    context.ui.setFooter((tui, theme, data) => {
      repaint = () => tui.requestRender();
      const unsubscribe = data.onBranchChange(repaint);
      return {
        invalidate() {}, dispose() { unsubscribe(); repaint = () => {}; },
        render(width: number): string[] {
          if (!ctx || width < 1) return [];
          editorFrame?.ensure();
          const dim = (text: string) => process.env.NO_COLOR ? text : theme.fg("dim", text);
          const model = ctx.model;
          const state = activity.label();
          const busy = activity.active || activity.compacting;
          const mark = busy ? "◇" : activity.cancelled ? "·" : activity.failed ? "×" : "●";
          const elapsed = busy && activity.started ? ` ${Math.floor((Date.now() - activity.started) / 1000)}s` : "";
          const modelText = model?.name ?? "Select a model";
          const thinking = model?.reasoning ? pi.getThinkingLevel() : "off";
          const hint = width >= 70 ? "  <Alt+M> controls" : width >= 32 ? "  /candy" : "";
          const suffix = width >= 24 ? dim(" · ") + ink(theme, "cyan", thinking) + dim(hint) : "";
          const top = ink(theme, "purple", middle(modelText, width - visibleWidth(suffix))) + suffix;
          const usage = ctx.getContextUsage();
          const percent = usage?.percent;
          const contextUsage = percent == null ? "ctx —" : `ctx ${Math.round(percent)}%`;
          const location = basename(ctx.cwd) + (data.getGitBranch() ? ` · ${data.getGitBranch()}` : "");
          const status = ink(theme, activity.failed || busy ? "yellow" : "pink", `${mark} ${state}${elapsed}`);
          const details = width >= 80
            ? `${contextUsage}  ↑${number(input)} ↓${number(output)}  $${cost.toFixed(3)}  ${location}`
            : `${contextUsage}  ${location}`;
          const lines = [top, status + dim(`  ·  ${details}`)];
          const statuses = [...data.getExtensionStatuses().values()].filter(Boolean);
          if (statuses.length) lines.push(statuses.join(dim("  ·  ")));
          return lines.map((line) => truncateToWidth(line, width));
        },
      };
    });
  };

  const open = async (context: ExtensionContext) => {
    if (context.mode !== "tui" || closePanel) return;
    if (!context.isIdle()) { context.ui.notify("Finish or cancel the current run before changing models.", "info"); return; }
    const owner = generation;
    const models = selectModels(context.modelRegistry.getAvailable(), context.scopedModels);
    try {
      await context.ui.custom<void>((tui, theme, _keys, done) => {
        closePanel = () => done();
        return new CandyPanel({
          models, current: context.model, thinking: pi.getThinkingLevel(),
          expanded: context.ui.getToolsExpanded(), theme,
          rows: () => tui.terminal.rows, render: () => tui.requestRender(), done: () => done(),
          apply: async (choice) => {
            if (generation !== owner) throw new Error("The session changed. Reopen the controls.");
            if (!context.isIdle()) throw new Error("The agent is working. Try again when it is ready.");
            if ("model" in choice) {
              if (!await pi.setModel(choice.model)) throw new Error("No configured credentials. Connect this provider with /login.");
            } else if ("thinking" in choice) pi.setThinkingLevel(choice.thinking as Parameters<typeof pi.setThinkingLevel>[0]);
            else context.ui.setToolsExpanded(choice.expanded);
            repaint();
          },
        });
      });
    } finally { closePanel = undefined; }
  };

  pi.registerCommand("candy", {
    description: "Open model, thinking, and display controls. Use off/on to toggle Candy UI.",
    handler: async (args, context) => {
      if (context.mode !== "tui") return;
      const action = args.trim();
      if (action === "off") { enabled = false; stopTimer(); restoreModels?.(); restoreModels = undefined; editorFrame?.dispose(true); editorFrame = undefined; context.ui.setFooter(undefined); return; }
      if (action === "on") { enabled = true; ctx = context; totals(); mount(context); return; }
      if (action) { context.ui.notify("Use /candy, /candy on, or /candy off.", "info"); return; }
      await open(context);
    },
  });
  pi.registerShortcut("alt+m", { description: "Open Candy controls", handler: open });
  pi.on("session_start", (_event, context) => {
    generation++; stopTimer(); closePanel?.(); restoreModels?.(); restoreModels = undefined; editorFrame?.dispose(); editorFrame = undefined; ctx = context; activity = new Activity(); totals();
    if (enabled) mount(context);
  });
  pi.on("agent_start", (_event, context) => {
    activity.start(); refresh(context); stopTimer();
    if (context.mode === "tui" && enabled) { timer = setInterval(() => repaint(), 1000); timer.unref?.(); }
  });
  pi.on("tool_execution_start", (event, context) => { activity.toolStart(event.toolCallId, event.toolName); refresh(context); });
  pi.on("tool_execution_end", (event, context) => { activity.toolEnd(event.toolCallId, event.isError); refresh(context); });
  pi.on("message_end", (event, context) => {
    if (event.message.role === "assistant") {
      activity.failed ||= event.message.stopReason === "error";
      activity.cancelled ||= event.message.stopReason === "aborted";
    }
    ctx = context; totals(); repaint();
  });
  pi.on("agent_settled", (_event, context) => { activity.settle(); stopTimer(); ctx = context; totals(); repaint(); });
  pi.on("session_before_compact", (_event, context) => { activity.compacting = true; refresh(context); });
  pi.on("session_compact", (_event, context) => { activity.compacting = false; ctx = context; totals(); repaint(); });
  pi.on("session_compact_failed", (event, context) => {
    activity.compacting = false; activity.failed ||= !event.aborted; refresh(context);
  });
  pi.on("model_select", (_event, context) => refresh(context));
  pi.on("thinking_level_select", (_event, context) => refresh(context));
  pi.on("session_tree", (_event, context) => { ctx = context; totals(); repaint(); });
  pi.on("session_shutdown", () => { generation++; closePanel?.(); stopTimer(); restoreModels?.(); restoreModels = undefined; editorFrame?.dispose(); editorFrame = undefined; repaint = () => {}; ctx = undefined; });
}
