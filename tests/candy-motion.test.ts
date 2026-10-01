import assert from "node:assert/strict";
import { test } from "node:test";
import { FrameMotion } from "../pi/extensions/candy-ui/motion.ts";
const state = { mode: "Chat", thinking: "high", busy: false, failed: false, light: false };

test("entrance and mode changes animate, then stop at idle", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0;
  const motion = new FrameMotion(() => renders++);
  motion.update(state);
  const frames = new Set<string>();
  for (let i = 0; i < 24; i++) { frames.add(motion.paint("─".repeat(30), 0, 0, 30, 4) + motion.paint("─".repeat(30), 0, 3, 30, 4)); t.mock.timers.tick(40); }
  assert.ok(frames.size > 8);
  const idle = renders; t.mock.timers.tick(5000); assert.equal(renders, idle);
  motion.update({ ...state, mode: "Shell" }); t.mock.timers.tick(80); assert.ok(renders > idle);
  motion.dispose();
});

test("work moves around the border and disposal stops all callbacks", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0;
  const motion = new FrameMotion(() => renders++);
  motion.update({ ...state, busy: true }); t.mock.timers.tick(1100);
  const before = motion.paint("─".repeat(40), 0, 0, 40, 4);
  t.mock.timers.tick(250);
  assert.notEqual(motion.paint("─".repeat(40), 0, 0, 40, 4), before);
  motion.dispose(); const count = renders; t.mock.timers.tick(5000); assert.equal(renders, count);
});

test("reduced motion never schedules and geometry is bounded", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0;
  const motion = new FrameMotion(() => renders++, false, false);
  motion.update({ ...state, busy: true });
  assert.equal(motion.paint("╭────╮", 0, 0, 6, 3), "╭────╮");
  for (const width of [1, 2, 6, 80]) assert.equal(motion.paint("─".repeat(width),0,0,width,3).length,width);
  t.mock.timers.tick(10000); assert.equal(renders, 0); motion.dispose();
});
