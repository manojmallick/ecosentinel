import assert from "node:assert/strict";
import test from "node:test";

import { describeAqi, formatPollutant, getAqiBand } from "./aqiColors.ts";

test("getAqiBand returns the matching EPA band for low readings", () => {
  assert.equal(getAqiBand(48).label, "Good");
  assert.equal(getAqiBand(48).color, "#22c55e");
});

test("getAqiBand rolls into the hazardous fallback band for very high readings", () => {
  assert.equal(getAqiBand(640).label, "Hazardous");
});

test("formatPollutant returns a dash for missing values and one decimal place otherwise", () => {
  assert.equal(formatPollutant(null), "—");
  assert.equal(formatPollutant(18.456), "18.5");
});

test("describeAqi combines the category label and numeric AQI", () => {
  assert.equal(describeAqi(91), "Moderate air (91 AQI)");
});
