import test from "node:test";
import assert from "node:assert/strict";
import { groupSewageOutfalls, SewageOutfall } from "./sewage-discharge";

test("sewage clusters split on zoom, preserve coordinates, and keep coincident outfalls accessible together", () => {
  const outfalls = [
    { id: "a", latitude: 41, longitude: -87 },
    { id: "b", latitude: 41, longitude: -87 },
    { id: "c", latitude: 41.001, longitude: -87.001 },
  ] as SewageOutfall[];
  const overview = groupSewageOutfalls(outfalls, 4, () => ({ x: 1, y: 1 }));
  assert.equal(overview.length, 1);
  const detail = groupSewageOutfalls(outfalls, 14, () => ({ x: 1, y: 1 }));
  assert.equal(detail.length, 2);
  assert.deepEqual(detail[0][1], outfalls.slice(0, 2));
  assert.equal(detail[1][1][0], outfalls[2]);
  assert.deepEqual(detail.flatMap(([, sites]) => sites), outfalls);
});
