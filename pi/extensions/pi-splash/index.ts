import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { SplashHeader, type Ink } from "./header.ts";

function makePaint(theme: Theme): (ink: Ink, text: string) => string {
  let colors: Record<string, unknown> = {};
  try {
    colors = JSON.parse(readFileSync(join(getAgentDir(), "pi-startup-header.json"), "utf8")).general ?? {};
  } catch {
    // Use the current theme if the optional color file is absent or invalid.
  }
  const fields = { accent: "logoGradientBase", highlight: "textHighlight", text: "textBase", dim: "" };
  const fallback = { accent: "accent", highlight: "warning", text: "text", dim: "dim" } as const;
  return (ink, text) => {
    const color = colors[fields[ink]];
    if (typeof color === "string" && /^#[\da-f]{6}$/i.test(color) && !process.env.NO_COLOR) {
      const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
      return `\x1b[38;2;${rgb.join(";")}m${text}\x1b[39m`;
    }
    return process.env.NO_COLOR ? text : theme.fg(fallback[ink], text);
  };
}

export default function piSplash(pi: ExtensionAPI): void {
  let header: SplashHeader | undefined;
  const dispose = () => {
    header?.dispose();
    header = undefined;
  };
  pi.on("session_start", (event, ctx) => {
    dispose();
    if (ctx.mode !== "tui") return;
    ctx.ui.setHeader((tui, theme) => {
      dispose();
      header = new SplashHeader({
        paint: makePaint(theme),
        requestRender: () => tui.requestRender(),
        color: !process.env.NO_COLOR,
        getAvailableHeight: () => Math.max(2, tui.terminal.rows - 8),
        animate: event.reason === "startup" && !ctx.sessionManager.getBranch().some((entry) => entry.type === "message")
          && process.env.PI_SPLASH_ANIMATION !== "0" && !process.env.NO_COLOR,
      });
      return header;
    });
  });
  pi.on("before_agent_start", () => header?.finish());
  pi.on("session_shutdown", dispose);
}
