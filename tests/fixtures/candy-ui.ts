import { appendFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { visibleWidth, CURSOR_MARKER, getKeybindings } from "@earendil-works/pi-tui";
import { CustomEditor, ModelSelectorComponent, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { decorateEditor } from "../../pi/extensions/candy-ui/editor.ts";
import { CandyPanel } from "../../pi/extensions/candy-ui/ui.ts";
import { renderModelFrame } from "../../pi/extensions/candy-ui/model-panel.ts";

export default function (pi: ExtensionAPI) {
  const report = process.env.CANDY_UI_REPORT;
  if (!report) throw new Error("CANDY_UI_REPORT is required for this test fixture");
  const write = (value: unknown) => appendFileSync(report, JSON.stringify(value) + "\n");
  let observer = 0;
  const observeModels = () => {
    const owner = ++observer;
    const nativeRender = ModelSelectorComponent.prototype.render;
    ModelSelectorComponent.prototype.render = function (width: number) {
      const lines = nativeRender.call(this, width);
      if (owner === observer) appendFileSync(report + ".models.jsonl", JSON.stringify({ time: Date.now(), width, lines }) + "\n");
      return lines;
    };
  };
  pi.registerProvider("candy-test", {
    baseUrl: "http://127.0.0.1:9", apiKey: "test-only", api: "openai-completions",
    models: ["one", "two"].map((id) => ({ id, name: `Candy 中文 ${id}`, reasoning: true,
      input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000, maxTokens: 8192 })),
  });
  pi.registerShortcut("alt+j", { description: "Test snapshot", handler: (ctx) => write({
    model: ctx.model?.id, thinking: pi.getThinkingLevel(), draft: ctx.ui.getEditorText(),
    expanded: ctx.ui.getToolsExpanded(),
  }) });
  pi.registerShortcut("alt+k", { description: "Clear test draft", handler: (ctx) => ctx.ui.setEditorText("") });
  pi.registerShortcut("alt+o", { description: "Observe current model renderer", handler: observeModels });
  pi.registerCommand("editor-probe", { description: "Check editor decoration", handler: async (_args, ctx) => {
    await ctx.ui.custom<void>((tui, _theme, keys, done) => {
      const plain = (text: string) => text;
      const editor = new CustomEditor(tui, { borderColor: plain, selectList: {
        selectedPrefix: plain, selectedText: plain, description: plain, scrollInfo: plain, noMatch: plain,
      } }, keys);
      const text = "中文🌿é与输入法光标\n" + "A long editable line ".repeat(10);
      editor.setText(text); editor.focused = true;
      const stop = decorateEditor(editor, () => {}, () => ({ thinking: "high", busy: false, failed: false, label: "Ready" }), () => false, false, false);
      for (const width of [6, 12, 20, 40, 80]) {
        const lines = editor.render(width);
        assert.equal(lines.join("").split(CURSOR_MARKER).length - 1, 1);
        for (const line of lines) assert.ok(visibleWidth(line) <= width, "Editor exceeds width");
        assert.ok(lines[0].startsWith("╭"));
        assert.equal(editor.getText(), text);
      }
      stop(); write({ editor: "Chinese width, cursor, text and border checks passed" });
      done(); return { render: () => [] };
    });
  } });
  pi.on("session_start", async (_event, ctx) => {
    observeModels();
    const content = ["Search › 中文" + CURSOR_MARKER, "→ 中文🌿 é model one", "  model two", "Enter to select"];
    for (const progress of [0, .1, .3, .65, .8, 1]) for (const width of [6, 7, 12, 20, 40, 80]) {
      const lines = renderModelFrame(content, width, progress, false);
      assert.equal(lines.join("").split(CURSOR_MARKER).length - 1, 1, "Model frame loses its IME cursor");
      for (const line of lines) assert.ok(visibleWidth(line) <= width, "Model frame exceeds width");
      if (progress === 1) assert.equal(stripVTControlCharacters(lines[0]), "╭" + "─".repeat(width - 2) + "╮");
    }
    ctx.ui.setStatus("test-existing", "Existing plugin status");
    const models = ctx.modelRegistry.getAvailable().filter((m) => m.provider === "candy-test");
    let rows = 32, closed = false, attempts = 0;
    const panel = new CandyPanel({ models, current: models[0], thinking: "off", expanded: false,
      theme: ctx.ui.theme, rows: () => rows, render() {}, done() { closed = true; },
      apply: async () => { attempts++; throw new Error("Test apply failed"); },
    });
    writeFileSync(report + ".panel.json", JSON.stringify(panel.render(90)));
    panel.focused = true;
    assert.ok(panel.render(100).join("").includes(CURSOR_MARKER), "IME cursor is missing");
    for (const height of [10, 20, 40]) {
      rows = height;
      for (const width of [1, 20, 40, 80, 140]) {
        const lines = panel.render(width);
        assert.ok(lines.length <= height);
        for (const line of lines) assert.ok(visibleWidth(line) <= width);
        assert.doesNotMatch(lines.join(""), /[╭╮╰╯│─]/);
      }
    }
    rows = 10;
    panel.handleInput("\t");
    for (let i = 0; i < 4; i++) panel.handleInput("\x1b[B");
    assert.match(panel.render(40).join(""), /› high/, "Selected thinking level must stay visible");
    panel.handleInput("\x1b[Z");
    rows = 32;
    panel.handleInput("NoSuchModel"); panel.handleInput("\r");
    assert.equal(attempts, 0, "Empty results must not apply another model");
    panel.handleInput("\u0015"); panel.handleInput("two"); panel.handleInput("\r");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(attempts, 1);
    assert.equal(closed, false);
    assert.match(panel.render(100).join(""), /Test apply failed/);
    panel.handleInput("\u001b"); assert.equal(closed, true);
    panel.dispose();
    write({ checks: "panel width, IME, no border, no-result and failure behavior passed",
      saveKeys: getKeybindings().getKeys("app.models.save") });
  });
}
