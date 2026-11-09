import test from "node:test";
import assert from "node:assert/strict";
import { overdoseFill, overdoseWindowLabel, overdosePeriodLabel, OVERDOSE_LEGEND, OVERDOSE_SUPPRESSED_COLOR, OVERDOSE_UNAVAILABLE_COLOR, OverdoseCounty } from "./drug-overdose";

test("overdose colors keep suppressed and unavailable counties distinct from zero and use stable rate thresholds", () => {
  const county = { countStatus: "reported", rate: 0 } as OverdoseCounty;
  assert.equal(overdoseFill(county), OVERDOSE_LEGEND[0].color);
  assert.equal(overdoseFill({ ...county, countStatus: "suppressed", rate: null }), OVERDOSE_SUPPRESSED_COLOR);
  assert.equal(overdoseFill({ ...county, rate: null }), OVERDOSE_UNAVAILABLE_COLOR);
  assert.equal(overdoseFill(), OVERDOSE_UNAVAILABLE_COLOR);
  for (const rate of [-1, NaN, Infinity]) assert.equal(overdoseFill({ ...county, rate }), OVERDOSE_UNAVAILABLE_COLOR);
  for (const [rate, bin] of [[0.1, 1], [9.9, 1], [10, 2], [20, 3], [30, 4], [40, 5], [60, 6], [1000, 6]]) {
    assert.equal(overdoseFill({ ...county, rate }), OVERDOSE_LEGEND[bin].color);
  }
});

test("overdose dates describe rolling twelve-month windows across year boundaries", () => {
  assert.equal(overdoseWindowLabel("2026-03"), "Apr 2025 – Mar 2026");
  assert.equal(overdoseWindowLabel("2025-12"), "Jan 2025 – Dec 2025");
  assert.equal(overdoseWindowLabel("2020-01"), "Feb 2019 – Jan 2020");
  assert.equal(overdosePeriodLabel("2026-03"), "Mar 2026");
  assert.equal(overdoseWindowLabel("2026-13"), "");
  assert.equal(overdosePeriodLabel("latest"), "Latest available");
});
