import test from "node:test";
import assert from "node:assert/strict";
import { parseImportFiles, toImportDocument } from "./importExport.js";

function importFile(name, text) {
  return { name, text: async () => text };
}

test("parses all six record types with the versioned timezone format", async () => {
  const file = importFile("all.json", JSON.stringify({
    version: 1,
    timezone: "Asia/Kolkata",
    routines: [{ title: "Morning care", startsAt: "2026-11-06T08:30", recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [1, 3] } }],
    meals: [{ title: "Breakfast", mealType: "breakfast", scheduledAt: "2026-11-06T09:00", vegetarian: true }],
    reminders: [{ title: "Take a walk", date: "2026-11-06", time: "14:05", recurrence: { frequency: "daily", interval: 1 }, notes: "If it feels good" }],
    checkins: [{ date: "2026-11-06", checkIn: { mood: "okay", energy: "good" } }],
    appointments: [{ title: "Clinic visit", scheduledAt: "2026-11-08T12:00", appointment: { provider: "Dr Lee", location: "Clinic" } }],
    journal: [{ title: "A note", scheduledAt: "2026-11-06T20:15", notes: "A private reflection", journal: { mood: "good", tags: ["rest"] } }],
  }));
  const result = await parseImportFiles([file], "UTC");
  assert.deepEqual(result.problems, []);
  assert.equal(result.entries.length, 6);
  assert.deepEqual(result.categories.sort(), ["appointment", "checkin", "journal", "meal", "reminder", "routine"]);
  assert.equal(result.entries.find((entry) => entry.category === "reminder").reminderEnabled, true);
  assert.equal(result.entries.find((entry) => entry.category === "checkin").title, "Daily wellness check-in");
  assert.equal(result.entries.find((entry) => entry.category === "routine").startsAt, "2026-11-06T03:00:00.000Z");
});

test("parses a CSV type column and reports bad rows and duplicate rows", async () => {
  const file = importFile("records.csv", [
    "type,title,date,time,notes",
    "reminder,Medication,2026-11-06,09:15,",
    "reminder,Medication,2026-11-06,09:15,duplicate",
    "appointment,Visit,not-a-date,10:00,",
    "unknown,Other,2026-11-06,10:00,",
  ].join("\n"));
  const result = await parseImportFiles([file], "UTC");
  assert.equal(result.entries.length, 1);
  assert.deepEqual(result.categories, ["reminder"]);
  assert.equal(result.problems.length, 3);
  assert.ok(result.problems.some((problem) => /duplicate/.test(problem)));
  assert.ok(result.problems.some((problem) => /date/.test(problem)));
  assert.ok(result.problems.some((problem) => /unknown type/.test(problem)));
});

test("recognizes type-specific CSV filenames and rejects empty or malformed inputs", async () => {
  const csv = await parseImportFiles([importFile("reminders.csv", "title,date,time\nWater plants,2026-11-06,18:00")], "UTC");
  assert.equal(csv.entries[0].category, "reminder");

  const empty = await parseImportFiles([importFile("empty.json", '{"version":1,"timezone":"UTC"}')]);
  assert.ok(empty.problems.some((problem) => problem.includes("no importable rows")));

  const invalid = await parseImportFiles([importFile("bad.json", '{"version":2,"reminders":[{"notes":"missing title","scheduledAt":"yesterday"}]}')]);
  assert.ok(invalid.problems.some((problem) => problem.includes("version must be 1")));
  assert.ok(invalid.problems.some((problem) => problem.includes("title is required")));
  assert.equal(invalid.entries.length, 0);
});

test("rejects unsupported file types before reading their contents", async () => {
  const result = await parseImportFiles([{ name: "records.pdf", text: async () => { throw new Error("should not read"); } }]);
  assert.deepEqual(result.problems, ["Only JSON and CSV import files are supported."]);
});

test("exports and imports record fields without changing timezone wall time", async () => {
  const records = [{
    category: "meal",
    title: "Lunch",
    notes: "Simple",
    scheduledAt: "2026-11-06T06:30:00.000Z",
    mealType: "lunch",
    ingredients: "Rice",
    vegetarian: true,
    recurrence: { frequency: "none", interval: 1 },
  }];
  const document = toImportDocument(records, "Asia/Kolkata");
  assert.equal(document.meals[0].scheduledAt, "2026-11-06T12:00");
  const imported = await parseImportFiles([importFile("backup.json", JSON.stringify(document))]);
  assert.equal(imported.entries[0].scheduledAt, records[0].scheduledAt);
  assert.equal(imported.entries[0].ingredients, "Rice");
});

test("previews imports with more than 500 rows", async () => {
  const rows = ["type,title,date,time"];
  for (let index = 0; index < 501; index += 1) rows.push(`journal,Entry ${index},2026-11-06,${String(index % 24).padStart(2, "0")}:00`);
  const result = await parseImportFiles([importFile("large.csv", rows.join("\n"))], "UTC");
  assert.equal(result.entries.length, 501);
  assert.deepEqual(result.problems, []);
});
