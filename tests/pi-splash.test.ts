import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { SplashHeader, DURATION_MS } from "../pi/extensions/pi-splash/header.ts";

const plain = (_role: string, value: string) => value;

test("the wordmark appears without a border or layout movement", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0;
  const header = new SplashHeader({ paint: plain, requestRender: () => renders++ });
  const frames: string[][] = [header.render(80)];
  for (let elapsed = 0; elapsed < DURATION_MS; elapsed += 32) {
    t.mock.timers.tick(32);
    frames.push(header.render(80));
  }
  assert.ok(new Set(frames.map((lines) => lines.join("\n"))).size > 10);
  assert.equal(new Set(frames.map((lines) => lines.length)).size, 1);
  assert.ok(frames.at(-1)!.some((line) => line.includes("ready when you are")));
  for (const frame of frames) assert.doesNotMatch(frame.join("\n"), /[╭╮╰╯─│]/);
  const settled = renders;
  t.mock.timers.tick(10000);
  assert.equal(renders, settled, "idle headers must not keep refreshing");
});

test("all frames fit narrow and wide terminals, including resize", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const header = new SplashHeader({ paint: plain, requestRender() {} });
  for (const width of [0, 1, 8, 20, 24, 39, 40, 80, 160, 32]) {
    for (const line of header.render(width)) assert.ok([...stripVTControlCharacters(line)].length <= width);
    t.mock.timers.tick(96);
  }
  header.dispose();
});

test("disabled motion renders the final logo and does not start timers", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0;
  const header = new SplashHeader({ paint: plain, requestRender: () => renders++, animate: false });
  const first = header.render(80);
  assert.ok(first.some((line) => line.includes("ready when you are")));
  t.mock.timers.tick(10000);
  assert.deepEqual(header.render(80), first);
  assert.equal(renders, 0);
});

test("dispose cancels redraws even when called before the first frame", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  for (const start of [true, false]) {
    let renders = 0;
    const header = new SplashHeader({ paint: plain, requestRender: () => renders++ });
    if (start) header.render(80);
    header.dispose();
    header.dispose();
    header.render(80);
    t.mock.timers.tick(10000);
    assert.equal(renders, 0);
  }
});

test("the clock starts at the first visible frame, not component creation", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const header = new SplashHeader({ paint: plain, requestRender() {} });
  t.mock.timers.tick(10000);
  assert.ok(!header.render(80).some((line) => line.includes("ready when you are")));
  header.finish();
  assert.ok(header.render(80).some((line) => line.includes("ready when you are")));
  header.dispose();
});

test("the header uses the personal brand and never shows the Pi mark", () => {
  const header = new SplashHeader({ paint: plain, requestRender() {}, animate: false });
  for (const width of [24, 80]) {
    const output = header.render(width).join("\n");
    assert.ok(output.includes("woshahua"));
    assert.ok(!output.includes("π"));
  }
});

test("the sprite fits short terminals and expands when there is room", () => {
  let height = 14;
  const header = new SplashHeader({ paint: plain, requestRender() {}, animate: false,
    getAvailableHeight: () => height });
  assert.ok(header.render(80).length <= height);
  height = 24;
  assert.ok(header.render(80).length > 14);
  assert.ok(header.render(80).length <= height);
});
