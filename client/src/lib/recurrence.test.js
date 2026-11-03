import assert from "node:assert/strict";
import test from "node:test";
import { occursOn, localDateKey, occurrenceStatus } from "./recurrence.js";

test("matches weekly recurrence dates and occurrence completion states", () => {
  const record = {
    scheduledAt: "2026-11-02T12:00:00",
    recurrence: { frequency: "weekly", interval: 1, startDateKey: "2026-11-02", daysOfWeek: [1, 3] },
    occurrences: [{ dateKey: "2026-11-04", status: "completed" }],
  };
  assert.equal(occursOn(record, new Date(2026, 10, 4, 12)), true);
  assert.equal(occursOn(record, new Date(2026, 10, 5, 12)), false);
  assert.equal(occurrenceStatus(record, new Date(2026, 10, 4, 12)), "completed");
  assert.equal(localDateKey(new Date(2026, 10, 4, 12)), "2026-11-04");
});

test("matches monthly recurrences on the final day of shorter months", () => {
  const record = {
    scheduledAt: "2026-01-31T12:00:00",
    recurrence: { frequency: "monthly", interval: 1, startDateKey: "2026-01-31" },
  };
  assert.equal(occursOn(record, new Date(2026, 1, 28, 12)), true);
  assert.equal(occursOn(record, new Date(2026, 1, 27, 12)), false);
});
