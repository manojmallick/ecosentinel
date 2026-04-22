import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStreakDays,
  calculateTripImpact,
  createImpactEntry,
  formatTripMode,
  summariseImpact
} from "./impact.ts";

test("calculateTripImpact returns stronger savings for walking and biking than transit", () => {
  const bike = calculateTripImpact(8, "bike");
  const transit = calculateTripImpact(8, "transit");

  assert.equal(bike.co2KgAvoided, 1.5);
  assert.ok(bike.points > transit.points);
});

test("createImpactEntry normalizes distance and embeds calculated metrics", () => {
  const entry = createImpactEntry({
    distanceKm: 5.26,
    mode: "walk",
    createdAt: "2026-04-23T08:00:00.000Z"
  });

  assert.equal(entry.distanceKm, 5.3);
  assert.equal(entry.mode, "walk");
  assert.equal(entry.id, "walk-2026-04-23T08:00:00.000Z");
  assert.ok(entry.co2KgAvoided > 0);
  assert.ok(entry.points > 0);
});

test("calculateStreakDays counts consecutive daily activity", () => {
  const streak = calculateStreakDays([
    createImpactEntry({ distanceKm: 4, mode: "bike", createdAt: "2026-04-23T08:00:00.000Z" }),
    createImpactEntry({ distanceKm: 3, mode: "walk", createdAt: "2026-04-22T08:00:00.000Z" }),
    createImpactEntry({ distanceKm: 2, mode: "transit", createdAt: "2026-04-21T08:00:00.000Z" }),
    createImpactEntry({ distanceKm: 6, mode: "bike", createdAt: "2026-04-19T08:00:00.000Z" })
  ]);

  assert.equal(streak, 3);
});

test("summariseImpact combines personal logs with the community baseline", () => {
  const entries = [
    createImpactEntry({ distanceKm: 6, mode: "bike", createdAt: "2026-04-23T08:00:00.000Z" }),
    createImpactEntry({ distanceKm: 4, mode: "walk", createdAt: "2026-04-22T08:00:00.000Z" })
  ];

  const summary = summariseImpact(entries);

  assert.equal(summary.tripsLogged, 2);
  assert.equal(summary.streakDays, 2);
  assert.equal(summary.latestTrip?.mode, "bike");
  assert.ok(summary.personalCo2Kg > 0);
  assert.ok(summary.personalPoints > 0);
  assert.ok(summary.communityCo2Kg > summary.personalCo2Kg);
  assert.equal(formatTripMode("transit"), "Transit trip");
});
