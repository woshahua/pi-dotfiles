import assert from "node:assert/strict";
import { test } from "node:test";
import { PanelMotion, panelGeometry, panelRowVisible } from "../pi/extensions/candy-ui/panel-motion.ts";

test("the panel unfolds, reveals rows in order, and stops refreshing at rest", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0;
  const motion = new PanelMotion(() => renders++);
  motion.open();
  const heights = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const progress = motion.value();
    const geometry = panelGeometry(progress, 12);
    heights.add(geometry.rows);
    if (panelRowVisible(progress, 11, 12)) assert.ok(panelRowVisible(progress, 0, 12));
    t.mock.timers.tick(40);
  }
  assert.ok(heights.size > 5);
  assert.equal(motion.value(), 1);
  assert.equal(panelGeometry(1, 12).rows, 12);
  assert.equal(panelGeometry(1, 12).topReveal, 1);
  assert.ok(panelRowVisible(1, 11, 12));
  const idle = renders; t.mock.timers.tick(5000); assert.equal(renders, idle);
  let closed = false;
  motion.close(() => { closed = true; });
  t.mock.timers.tick(280); assert.ok(motion.value() > 0 && motion.value() < 1); assert.equal(closed, false);
  t.mock.timers.tick(280); assert.equal(motion.value(), 0); assert.equal(closed, true);
  const done = renders; t.mock.timers.tick(5000); assert.equal(renders, done);
  motion.dispose();
});

test("closing during entrance starts at the current size and disposal cancels completion", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0, completed = 0;
  const motion = new PanelMotion(() => renders++);
  motion.open(); t.mock.timers.tick(240);
  const size = motion.value();
  motion.close(() => completed++); assert.equal(motion.value(), size);
  t.mock.timers.tick(40); assert.ok(motion.value() < size);
  motion.dispose(); const count = renders;
  t.mock.timers.tick(5000); assert.equal(completed, 0); assert.equal(renders, count);
});

test("disabled motion applies and closes immediately without scheduling", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let renders = 0, closed = 0;
  const motion = new PanelMotion(() => renders++, false);
  motion.open(); assert.equal(motion.value(), 1);
  motion.close(() => closed++); assert.equal(motion.value(), 0); assert.equal(closed, 1);
  const count = renders; t.mock.timers.tick(5000); assert.equal(renders, count);
  for (const height of [0, 1, 2, 10]) for (const progress of [0, .1, .5, 1]) {
    const { rows, topReveal } = panelGeometry(progress, height);
    assert.ok(rows >= 1 && rows <= Math.max(1, height));
    assert.ok(topReveal >= 0 && topReveal <= 1);
  }
  motion.dispose();
});
