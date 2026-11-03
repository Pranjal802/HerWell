export function isValidDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === key;
}

export function dateTimeInTimeZone(key, hour, minute, timeZone) {
  if (!isValidDateKey(key) || !Number.isInteger(hour) || hour < 0 || hour > 23
    || !Number.isInteger(minute) || minute < 0 || minute > 59 || typeof timeZone !== "string" || !timeZone) {
    throw new TypeError("A valid date, local time, and time zone are required.");
  }
  const [year, month, day] = key.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = desired;
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const difference = desired - represented;
    if (!difference) break;
    timestamp += difference;
  }
  return new Date(timestamp);
}

export function nextOccurrenceKey(currentKey, recurrence) {
  if (!isValidDateKey(currentKey)) return null;
  const interval = recurrence.interval || 1;
  const current = new Date(`${currentKey}T12:00:00Z`);
  if (recurrence.frequency === "daily") {
    current.setUTCDate(current.getUTCDate() + interval);
    return current.toISOString().slice(0, 10);
  }
  if (recurrence.frequency === "monthly") {
    const day = current.getUTCDate();
    current.setUTCDate(1);
    current.setUTCMonth(current.getUTCMonth() + interval);
    const lastDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
    current.setUTCDate(Math.min(day, lastDay));
    return current.toISOString().slice(0, 10);
  }
  if (recurrence.frequency === "weekly") {
    const startKey = recurrence.startDateKey || currentKey;
    if (!isValidDateKey(startKey)) return null;
    const start = new Date(`${startKey}T00:00:00Z`);
    const weekStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) - start.getUTCDay() * 86_400_000;
    const selectedDays = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [current.getUTCDay()];
    for (let offset = 1; offset <= 7 * interval + 7; offset += 1) {
      const candidate = new Date(current);
      candidate.setUTCDate(candidate.getUTCDate() + offset);
      const week = Math.floor((Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate()) - weekStart) / (7 * 86_400_000));
      if (week >= 0 && week % interval === 0 && selectedDays.includes(candidate.getUTCDay())) {
        return candidate.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

export function isOccurrenceDate(record, key) {
  if (!isValidDateKey(key)) return false;
  const recurrence = record.recurrence || { frequency: "none", interval: 1 };
  const baseKey = recurrence.startDateKey || (record.scheduledAt && new Date(record.scheduledAt).toISOString().slice(0, 10));
  if (!baseKey || key < baseKey || (recurrence.endDateKey && key > recurrence.endDateKey)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  const base = new Date(`${baseKey}T00:00:00Z`);
  if (recurrence.frequency === "none") return key === baseKey;
  const interval = recurrence.interval || 1;
  if (recurrence.frequency === "daily") return Math.floor((date - base) / 86_400_000) % interval === 0;
  if (recurrence.frequency === "weekly") {
    const baseWeek = new Date(base); baseWeek.setUTCDate(base.getUTCDate() - base.getUTCDay());
    const dateWeek = new Date(date); dateWeek.setUTCDate(date.getUTCDate() - date.getUTCDay());
    const week = Math.floor((dateWeek - baseWeek) / (7 * 86_400_000));
    const days = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [base.getUTCDay()];
    return week >= 0 && week % interval === 0 && days.includes(date.getUTCDay());
  }
  if (recurrence.frequency === "monthly") {
    const month = (date.getUTCFullYear() - base.getUTCFullYear()) * 12 + date.getUTCMonth() - base.getUTCMonth();
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return month >= 0 && month % interval === 0 && date.getUTCDate() === Math.min(base.getUTCDate(), lastDay);
  }
  return false;
}
