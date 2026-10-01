import assert from "node:assert/strict";
import { test } from "node:test";
import { Activity, selectModels, filterModels, moveIndex } from "../pi/extensions/candy-ui/state.ts";

test("parallel tools remain active until every tool finishes", () => {
  const activity = new Activity();
  activity.start();
  activity.toolStart("1", "read"); activity.toolStart("2", "bash");
  activity.toolEnd("1", false);
  assert.match(activity.label(), /bash/);
  activity.toolEnd("2", true);
  assert.match(activity.label(), /Working/);
  activity.settle();
  assert.match(activity.label(), /error/i);
  activity.start(); activity.cancelled = true; activity.settle();
  assert.equal(activity.label(), "Cancelled");
});

test("models respect scope, deduplicate identities and filter Unicode", () => {
  const models = [{provider:"a",id:"one",name:"中文模型"}, {provider:"b",id:"two",name:"Other"}];
  assert.deepEqual(selectModels([...models, models[0]], [{model:models[1]}]), [models[1]]);
  assert.equal(selectModels([...models, models[0]], []).length, 2);
  assert.deepEqual(filterModels(models,"中文"),[models[0]]);
  assert.deepEqual(filterModels(models,"missing"),[]);
});

test("empty results cannot select another model", () => {
  assert.equal(moveIndex(3, 1, 0), -1);
  assert.equal(moveIndex(0, -1, 3), 2);
  assert.equal(moveIndex(2, 1, 3), 0);
});
