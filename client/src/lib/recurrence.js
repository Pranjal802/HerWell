export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function occursOn(record, date) {
  const recurrence = record.recurrence || { frequency: "none", interval: 1 };
  const baseKey = recurrence.startDateKey || (record.scheduledAt || record.startDate
    ? localDateKey(new Date(record.scheduledAt || record.startDate))
    : "");
  const key = localDateKey(date);
  const lastKey = recurrence.endDateKey || (record.endDate ? localDateKey(new Date(record.endDate)) : "");
  if (!baseKey || key < baseKey || (lastKey && key > lastKey)) return false;
  if (recurrence.frequency === "none") return key === baseKey;
  const [baseYear, baseMonth, baseDay] = baseKey.split("-").map(Number);
  const [year, month, day] = key.split("-").map(Number);
  const base = new Date(baseYear, baseMonth - 1, baseDay, 12);
  const current = new Date(year, month - 1, day, 12);
  const interval = recurrence.interval || 1;
  if (recurrence.frequency === "daily") return Math.round((current - base) / 86_400_000) % interval === 0;
  if (recurrence.frequency === "weekly") {
    const baseWeek = new Date(base); baseWeek.setDate(base.getDate() - base.getDay());
    const currentWeek = new Date(current); currentWeek.setDate(current.getDate() - current.getDay());
    const week = Math.round((currentWeek - baseWeek) / (7 * 86_400_000));
    const selectedDays = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [base.getDay()];
    return week >= 0 && week % interval === 0 && selectedDays.includes(current.getDay());
  }
  if (recurrence.frequency === "monthly") {
    const months = (year - baseYear) * 12 + month - baseMonth;
    const monthEnd = new Date(year, month, 0).getDate();
    return months >= 0 && months % interval === 0 && day === Math.min(baseDay, monthEnd);
  }
  return false;
}

export function occurrenceStatus(record, date = new Date()) {
  if (record.recurrence?.frequency === "none") return record.completed ? "completed" : record.status || "planned";
  return record.occurrences?.find((occurrence) => occurrence.dateKey === localDateKey(date))?.status || "planned";
}
