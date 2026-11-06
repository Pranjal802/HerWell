const sections = {
  routines: "routine",
  meals: "meal",
  reminders: "reminder",
  checkins: "checkin",
  appointments: "appointment",
  journal: "journal",
};

const sectionForCategory = Object.fromEntries(Object.entries(sections).map(([section, category]) => [category, section]));
const dateTimeFields = ["scheduledAt", "startsAt", "endsAt", "reminderAt"];
const dateFields = ["startDate", "endDate"];
const commonFields = ["title", "notes", ...dateTimeFields, ...dateFields, "categoryLabel", "recurrence", "reminderEnabled", "status", "completed"];
const fieldsByCategory = {
  routine: [...commonFields],
  meal: [...commonFields, "mealType", "ingredients", "preparation", "vegetarian"],
  reminder: [...commonFields, "linkRecordId"],
  checkin: [...commonFields, "checkIn", "measurement"],
  appointment: [...commonFields, "appointment"],
  journal: [...commonFields, "journal"],
};
const mealTypes = ["breakfast", "lunch", "dinner", "snack", "custom"];
const frequencies = ["none", "daily", "weekly", "monthly"];
const statuses = ["planned", "completed", "skipped", "cancelled"];
const checkInOptions = {
  mood: ["low", "okay", "good"],
  energy: ["low", "okay", "good"],
  sleep: ["restless", "okay", "restful"],
  appetite: ["less", "usual", "more"],
  digestion: ["noticeable", "okay", "comfortable"],
};
const appointmentLimits = { provider: 120, location: 250, purpose: 300, clinicianInstructions: 2000 };
const maxRows = 5000;

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validTimeZone(timeZone) {
  try { new Intl.DateTimeFormat("en", { timeZone }).format(); return true; }
  catch { return false; }
}

function dateTimeInTimeZone(dateKey, time, timeZone) {
  if (!isDateKey(dateKey) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = desired;
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const difference = desired - represented;
    if (!difference) break;
    timestamp += difference;
  }
  const result = new Date(timestamp);
  const rendered = formatter.formatToParts(result);
  const parts = Object.fromEntries(rendered.map(({ type, value }) => [type, value]));
  if (`${parts.year}-${parts.month}-${parts.day}` !== dateKey || `${parts.hour}:${parts.minute}` !== time) return null;
  return result.toISOString();
}

function normalizeDateTime(value, timeZone) {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string") return { error: "must be a date and time" };
  const local = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (local) {
    const normalized = dateTimeInTimeZone(local[1], local[2], timeZone);
    return normalized ? { value: normalized } : { error: "has an invalid date, time, or daylight-saving time" };
  }
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value))) {
    return { value: new Date(value).toISOString() };
  }
  return { error: "must use YYYY-MM-DDTHH:mm" };
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === "") return { value: null };
  if (!isDateKey(value)) return { error: "must use a valid YYYY-MM-DD date" };
  return { value: `${value}T00:00:00.000Z` };
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "TRUE" || value === "1") return true;
  if (value === "false" || value === "FALSE" || value === "0") return false;
  return null;
}

function normalizeRow(raw, category, timeZone) {
  const issues = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { issues: ["row must be an object"] };
  const row = { ...raw };
  const supportedFields = new Set([...fieldsByCategory[category], "date", "time", "type", "category"]);
  for (const key of Object.keys(row)) {
    if (!supportedFields.has(key)) issues.push(`unknown field "${key}"`);
  }
  if (row.type !== undefined && categoryFromType(row.type) !== category) issues.push("type does not match its section");
  if (row.category !== undefined && row.category !== category) issues.push("category does not match its section");

  if (row.date !== undefined || row.time !== undefined) {
    if (row.scheduledAt !== undefined) issues.push("use scheduledAt or date/time, not both");
    else if (!isDateKey(String(row.date || ""))) issues.push("date must use a valid YYYY-MM-DD date");
    else if (row.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(row.time))) issues.push("time must use 24-hour HH:mm");
    else row.scheduledAt = `${row.date}T${row.time || "00:00"}`;
  }
  delete row.date;
  delete row.time;
  delete row.type;
  delete row.category;

  const title = category === "checkin" ? "Daily wellness check-in" : row.title;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 120) issues.push("title is required and must be 120 characters or fewer");
  if (row.notes !== undefined && (typeof row.notes !== "string" || row.notes.length > 2000)) issues.push("notes must be 2000 characters or fewer");
  const values = { ...row, category, title: typeof title === "string" ? title.trim() : title };

  for (const field of dateTimeFields) {
    const result = normalizeDateTime(row[field], timeZone);
    if (result.error) issues.push(`${field} ${result.error}`);
    else if (result.value) values[field] = result.value;
    else delete values[field];
  }
  for (const field of dateFields) {
    const result = normalizeDate(row[field]);
    if (result.error) issues.push(`${field} ${result.error}`);
    else if (result.value) values[field] = result.value;
    else delete values[field];
  }
  if (category === "reminder") {
    values.reminderAt = values.reminderAt || values.scheduledAt || null;
    values.reminderEnabled = row.reminderEnabled === undefined ? Boolean(values.reminderAt) : parseBoolean(row.reminderEnabled);
  }
  if (row.reminderEnabled !== undefined && parseBoolean(row.reminderEnabled) === null) issues.push("reminderEnabled must be true or false");
  if (row.reminderEnabled !== undefined) values.reminderEnabled = parseBoolean(row.reminderEnabled);
  if (row.completed !== undefined && parseBoolean(row.completed) === null) issues.push("completed must be true or false");
  if (row.completed !== undefined) values.completed = parseBoolean(row.completed);
  if (row.status !== undefined && !statuses.includes(row.status)) issues.push("status must be planned, completed, skipped, or cancelled");

  const recurrence = row.recurrence ?? { frequency: "none", interval: 1 };
  if (!recurrence || typeof recurrence !== "object" || Array.isArray(recurrence)) issues.push("recurrence must be an object");
  else {
    const { frequency = "none", interval = 1, daysOfWeek = [], startDateKey, endDateKey } = recurrence;
    const weekdays = Array.isArray(daysOfWeek) ? daysOfWeek : [];
    if (!frequencies.includes(frequency)) issues.push("recurrence.frequency must be none, daily, weekly, or monthly");
    if (!Number.isInteger(Number(interval)) || Number(interval) < 1 || Number(interval) > 30) issues.push("recurrence.interval must be an integer from 1 to 30");
    if (!Array.isArray(daysOfWeek) || daysOfWeek.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6)) issues.push("recurrence.daysOfWeek must contain weekday numbers from 0 to 6");
    if (startDateKey !== undefined && !isDateKey(startDateKey)) issues.push("recurrence.startDateKey must use YYYY-MM-DD");
    if (endDateKey !== undefined && !isDateKey(endDateKey)) issues.push("recurrence.endDateKey must use YYYY-MM-DD");
    if (isDateKey(startDateKey) && isDateKey(endDateKey) && endDateKey < startDateKey) issues.push("recurrence.endDateKey must not be before startDateKey");
    values.recurrence = {
      frequency,
      interval: Number(interval),
      ...(weekdays.length ? { daysOfWeek: weekdays.map(Number) } : {}),
      ...(startDateKey ? { startDateKey } : {}),
      ...(endDateKey ? { endDateKey } : {}),
    };
  }

  if (category === "meal") {
    if (row.mealType !== undefined && !mealTypes.includes(row.mealType)) issues.push("mealType must be breakfast, lunch, dinner, snack, or custom");
    for (const [field, max] of [["ingredients", 1200], ["preparation", 2000]]) {
      if (row[field] !== undefined && (typeof row[field] !== "string" || row[field].length > max)) issues.push(`${field} must be ${max} characters or fewer`);
    }
    if (row.vegetarian !== undefined && parseBoolean(row.vegetarian) === null) issues.push("vegetarian must be true or false");
    if (row.vegetarian !== undefined) values.vegetarian = parseBoolean(row.vegetarian);
  }
  if (category === "checkin") {
    const checkIn = row.checkIn || {};
    if (!checkIn || typeof checkIn !== "object" || Array.isArray(checkIn)
      || Object.entries(checkIn).some(([key, value]) => !checkInOptions[key]?.includes(value))) {
      issues.push("checkIn contains an unsupported field or value");
    } else if (!Object.keys(checkIn).length && !String(row.notes || "").trim()) {
      issues.push("a check-in needs at least one answer or a note");
    }
    if (Object.keys(checkIn).length) values.checkIn = checkIn;
    if (row.measurement !== undefined) {
      const measurement = row.measurement;
      if (!measurement || typeof measurement !== "object" || Array.isArray(measurement)
        || typeof measurement.type !== "string" || measurement.type.length > 40
        || typeof measurement.unit !== "string" || measurement.unit.length > 20
        || !Number.isFinite(Number(measurement.value))
        || Number(measurement.value) < 0 || Number(measurement.value) > 100000) {
        issues.push("measurement fields are invalid");
      } else values.measurement = { ...measurement, value: Number(measurement.value) };
    }
  }
  if (category === "appointment") {
    const appointment = row.appointment || {};
    if (!appointment || typeof appointment !== "object" || Array.isArray(appointment)
      || Object.entries(appointment).some(([key, value]) => !appointmentLimits[key] || typeof value !== "string" || value.length > appointmentLimits[key])) {
      issues.push("appointment contains an unsupported field or value");
    }
    if (Object.keys(appointment).length) values.appointment = appointment;
  }
  if (category === "journal") {
    const journal = row.journal || {};
    if (!journal || typeof journal !== "object" || Array.isArray(journal)
      || (journal.mood !== undefined && !["low", "okay", "good"].includes(journal.mood))
      || (journal.tags !== undefined && (!Array.isArray(journal.tags) || journal.tags.length > 10 || journal.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 30)))) {
      issues.push("journal contains an unsupported mood or tags");
    }
    if (Object.keys(journal).length) values.journal = journal;
  }
  if (category === "routine" && row.categoryLabel !== undefined
    && (typeof row.categoryLabel !== "string" || row.categoryLabel.length > 60)) issues.push("categoryLabel must be 60 characters or fewer");

  return { values, issues };
}

function categoryFromType(type) {
  if (typeof type !== "string") return null;
  const normalized = type.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const aliases = {
    dailycheckin: "checkin",
    dailywellnesscheckin: "checkin",
    journalentry: "journal",
  };
  if (aliases[normalized]) return aliases[normalized];
  const match = Object.entries(sections).find(([section, category]) => [section, category].map((item) => item.replace(/[\s_-]+/g, "")).includes(normalized));
  return match?.[1] || null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(field); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field || row.length) { row.push(field); rows.push(row); }
  while (rows.length && rows.at(-1).every((item) => !item.trim())) rows.pop();
  return rows;
}

function setCsvValue(row, key, value) {
  const path = key.split(".");
  let current = row;
  for (const part of path.slice(0, -1)) current = current[part] ||= {};
  const last = path.at(-1);
  if (["recurrence", "appointment", "journal", "checkIn", "measurement"].includes(path[0]) && path.length === 1) {
    try { current[last] = JSON.parse(value); }
    catch { current[last] = value; }
  } else if (path[0] === "recurrence" && ["interval", "daysOfWeek"].includes(last)) {
    current[last] = last === "daysOfWeek" ? value.split(/[|;]/).map((part) => part.trim()) : Number(value);
  } else if (path[0] === "journal" && last === "tags") current[last] = value.split(/[|;]/).map((part) => part.trim()).filter(Boolean);
  else if (["reminderEnabled", "vegetarian"].includes(last)) current[last] = parseBoolean(value) ?? value;
  else current[last] = value;
}

function categoryFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, "");
  return categoryFromType(base);
}

function normalizeCsvFile(text, name, timezone, problems, entries, categorySet) {
  let parsed;
  try { parsed = parseCsv(text.replace(/^\uFEFF/, "")); }
  catch (error) { problems.push(`${name}: ${error.message}`); return; }
  if (parsed.length < 2) { problems.push(`${name}: CSV needs a header and at least one data row.`); return; }
  const headers = parsed[0].map((header) => header.trim());
  if (headers.some((header) => !header)) { problems.push(`${name}: CSV contains an empty column name.`); return; }
  const typeIndex = headers.findIndex((header) => ["type", "category"].includes(header.toLowerCase()));
  const fileCategory = typeIndex < 0 ? categoryFromFilename(name) : null;
  if (typeIndex < 0 && !fileCategory) {
    problems.push(`${name}: include a type column or use a recognized type in the filename (for example reminders.csv).`);
    return;
  }
  for (let index = 1; index < parsed.length; index += 1) {
    const cells = parsed[index];
    if (cells.every((cell) => !cell.trim())) continue;
    if (cells.length !== headers.length) {
      problems.push(`${name}, row ${index + 1}: expected ${headers.length} columns, found ${cells.length}.`);
      continue;
    }
    const category = typeIndex >= 0 ? categoryFromType(cells[typeIndex]) : fileCategory;
    if (!category) {
      problems.push(`${name}, row ${index + 1}: unknown type "${cells[typeIndex] || ""}".`);
      continue;
    }
    const raw = {};
    headers.forEach((header, column) => {
      if (column === typeIndex || cells[column] === undefined || cells[column] === "") return;
      setCsvValue(raw, header, cells[column]);
    });
    const result = normalizeRow(raw, category, timezone);
    if (result.issues.length) problems.push(`${name}, row ${index + 1}: ${result.issues.join("; ")}`);
    else {
      categorySet.add(category);
      entries.push({ ...result.values, _source: `${name}, row ${index + 1}` });
    }
  }
}

export async function parseImportFiles(files, defaultTimezone = "UTC") {
  const problems = [];
  const entries = [];
  const categorySet = new Set();
  let timezone = defaultTimezone;
  if (!files.length) return { entries, categories: [], problems: ["Choose a JSON or CSV file."] };
  if (files.some((file) => !/\.(json|csv)$/i.test(file.name))) {
    return { entries, categories: [], problems: ["Only JSON and CSV import files are supported."] };
  }
  if (files.some((file) => file.size > 5 * 1024 * 1024)) {
    return { entries, categories: [], problems: ["Import files must be smaller than 5 MB."] };
  }
  if (files.some((file) => /\.json$/i.test(file.name)) && files.length !== 1) {
    return { entries, categories: [], problems: ["Choose one JSON file at a time."] };
  }
  if (files.some((file) => /\.csv$/i.test(file.name)) && !validTimeZone(defaultTimezone)) {
    return { entries, categories: [], problems: ["Set a valid time zone in Settings before importing CSV dates."] };
  }
  for (const file of files) {
    const text = await file.text();
    if (/\.json$/i.test(file.name)) {
      let data;
      try { data = JSON.parse(text); }
      catch { problems.push("JSON file is not valid JSON."); continue; }
      if (!data || typeof data !== "object" || Array.isArray(data)) { problems.push("JSON file must contain an object."); continue; }
      if (data.version !== 1) problems.push("JSON version must be 1.");
      timezone = data.timezone || defaultTimezone;
      if (typeof timezone !== "string" || !validTimeZone(timezone)) { problems.push("JSON timezone must be a valid time zone."); timezone = "UTC"; }
      for (const key of Object.keys(data)) {
        if (!["version", "timezone", ...Object.keys(sections)].includes(key)) problems.push(`Unknown JSON section or field "${key}".`);
      }
      for (const [section, category] of Object.entries(sections)) {
        if (!Object.hasOwn(data, section)) continue;
        if (!Array.isArray(data[section])) { problems.push(`${section} must be an array.`); continue; }
        if (data[section].length === 0) categorySet.add(category);
        data[section].forEach((raw, index) => {
          const result = normalizeRow(raw, category, timezone);
          if (result.issues.length) problems.push(`${section}, row ${index + 1}: ${result.issues.join("; ")}`);
          else {
            categorySet.add(category);
            entries.push({ ...result.values, _source: `${section}, row ${index + 1}` });
          }
        });
      }
    } else normalizeCsvFile(text, file.name, timezone, problems, entries, categorySet);
  }
  if (!entries.length && !categorySet.size) problems.push("The file contains no importable rows.");
  if (entries.length > maxRows) problems.push(`Import files may contain at most ${maxRows} valid rows.`);
  const seen = new Set();
  const deduplicated = [];
  for (const entry of entries) {
    const schedule = entry.scheduledAt || entry.startsAt || "";
    const key = `${entry.category}|${entry.title.toLocaleLowerCase()}|${schedule}`;
    if (seen.has(key)) problems.push(`${entry._source}: duplicate of another row in this import.`);
    else { seen.add(key); deduplicated.push(entry); }
  }
  return { entries: deduplicated, categories: [...categorySet], problems, timezone };
}

export function toImportDocument(records, timeZone = "UTC") {
  const document = { version: 1, timezone: timeZone };
  for (const section of Object.keys(sections)) document[section] = [];
  for (const record of records) {
    const section = sectionForCategory[record.category];
    if (!section) continue;
    const row = {};
    for (const key of fieldsByCategory[record.category]) {
      if (record[key] === undefined) continue;
      if (dateTimeFields.includes(key) && record[key]) row[key] = localDateTimeForZone(record[key], timeZone);
      else if (dateFields.includes(key) && record[key]) row[key] = dateKeyForZone(record[key]);
      else if (key === "recurrence" && record[key]) {
        const recurrence = { ...record[key] };
        if (recurrence.interval === undefined) recurrence.interval = 1;
        row[key] = recurrence;
      } else row[key] = record[key];
    }
    document[section].push(row);
  }
  return document;
}

function localDateTimeForZone(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function dateKeyForZone(value) {
  return new Date(value).toISOString().slice(0, 10);
}
