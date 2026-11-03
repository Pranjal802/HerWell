import assert from "node:assert/strict";
import test from "node:test";
import { dateTimeInTimeZone, isOccurrenceDate, isValidDateKey, nextOccurrenceKey } from "./recurrence.js";

test("validates calendar date keys, including leap days", () => {
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2025-02-29"), false);
  assert.equal(isValidDateKey("2024-2-09"), false);
});

test("matches daily and bounded recurring dates", () => {
  const record = {
    scheduledAt: new Date("2026-11-01T08:00:00Z"),
    recurrence: { frequency: "daily", interval: 2, startDateKey: "2026-11-01", endDateKey: "2026-11-07" },
  };
  assert.equal(isOccurrenceDate(record, "2026-11-01"), true);
  assert.equal(isOccurrenceDate(record, "2026-11-03"), true);
  assert.equal(isOccurrenceDate(record, "2026-11-02"), false);
  assert.equal(isOccurrenceDate(record, "2026-11-09"), false);
});

test("matches selected weekly days and interval weeks", () => {
  const record = {
    scheduledAt: new Date("2026-11-02T08:00:00Z"),
    recurrence: { frequency: "weekly", interval: 2, startDateKey: "2026-11-02", daysOfWeek: [1, 3] },
  };
  assert.equal(isOccurrenceDate(record, "2026-11-04"), true);
  assert.equal(isOccurrenceDate(record, "2026-11-09"), false);
  assert.equal(isOccurrenceDate(record, "2026-11-16"), true);
});

test("keeps monthly occurrences on the last valid day of short months", () => {
  const record = {
    scheduledAt: new Date("2026-01-31T08:00:00Z"),
    recurrence: { frequency: "monthly", interval: 1, startDateKey: "2026-01-31" },
  };
  assert.equal(isOccurrenceDate(record, "2026-02-28"), true);
  assert.equal(isOccurrenceDate(record, "2026-02-27"), false);
});

test("advances recurring reminder date keys independently of UTC reminder time", () => {
  assert.equal(nextOccurrenceKey("2026-11-03", { frequency: "daily", interval: 1 }), "2026-11-04");
  assert.equal(nextOccurrenceKey("2026-11-04", {
    frequency: "weekly",
    interval: 2,
    startDateKey: "2026-11-02",
    daysOfWeek: [1, 3],
  }), "2026-11-16");
  assert.equal(nextOccurrenceKey("2026-01-31", { frequency: "monthly", interval: 1 }), "2026-02-28");
  assert.equal(nextOccurrenceKey("invalid", { frequency: "daily", interval: 1 }), null);
});

test("schedules recurring reminder wall times across daylight-saving changes", () => {
  assert.equal(dateTimeInTimeZone("2026-03-08", 9, 30, "America/New_York").toISOString(), "2026-03-08T13:30:00.000Z");
  assert.equal(dateTimeInTimeZone("2026-11-02", 9, 30, "America/New_York").toISOString(), "2026-11-02T14:30:00.000Z");
});
