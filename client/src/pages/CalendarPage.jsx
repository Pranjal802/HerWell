import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { occursOn, occurrenceStatus, localDateKey } from "../lib/recurrence.js";
import { localeFor } from "../lib/translations.js";

export default function CalendarPage({ records, onOccurrence }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState("week");
  const days = useMemo(() => {
    const start = new Date(anchor);
    if (view === "month") {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay());
      return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
    }
    if (view === "day") return [new Date(anchor)];
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [anchor, view]);
  const locale = localeFor();
  const title = view === "month"
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor)
    : view === "day" ? new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(anchor)
      : `${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(days[0])} – ${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(days[6])}`;
  const scheduled = records.filter((record) => record.scheduledAt || record.startDate || record.recurrence?.startDateKey);
  function move(direction) {
    const next = new Date(anchor);
    next.setDate(next.getDate() + direction * (view === "month" ? 30 : view === "day" ? 1 : 7));
    setAnchor(next);
  }
  return <>
    <PageHeader title="Calendar" description="A look at what you have chosen to schedule." action={<div className="flex rounded-lg border border-[#e2e8df] bg-white p-1">{["day", "week", "month"].map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-md px-3 py-1.5 text-xs capitalize ${view === item ? "bg-[#edf3ea] font-semibold text-[#45664e]" : "text-[#78867d]"}`}>{item}</button>)}</div>} />
    <section className="rounded-2xl border border-[#e9ede5] bg-white p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between"><button onClick={() => move(-1)} aria-label="Previous period" className="rounded-lg p-2 text-[#65756a] hover:bg-[#f4f6f2]"><ChevronLeft size={18} /></button><h2 className="text-sm font-semibold text-[#46594b]">{title}</h2><button onClick={() => move(1)} aria-label="Next period" className="rounded-lg p-2 text-[#65756a] hover:bg-[#f4f6f2]"><ChevronRight size={18} /></button></header>
      {view === "month" && <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold text-[#87948a]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>}
      <div className={view === "month" ? "grid grid-cols-7 gap-1" : "space-y-2"}>
        {days.map((day) => {
          const events = scheduled.filter((record) => occursOn(record, day));
          return <div key={day.toISOString()} className={view === "month" ? `min-h-20 rounded-lg border p-1.5 ${day.getMonth() === anchor.getMonth() ? "border-[#edf0e9] bg-white" : "border-transparent bg-[#fafbf9]"}` : "grid gap-3 rounded-xl border border-[#edf0e9] p-3 sm:grid-cols-[145px_1fr]"}>
            <div className={`text-xs ${day.toDateString() === new Date().toDateString() ? "font-bold text-[#3d6949]" : "text-[#78867d]"}`}>{view === "month" ? day.getDate() : day.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" })}</div>
            <div className="mt-1 space-y-1">{events.map((event) => <div key={event._id} className="truncate rounded-md bg-[#edf3ea] px-2 py-1 text-[10px] text-[#45664e]" title={event.title}><span>{event.title}</span>{event.recurrence?.frequency && event.recurrence.frequency !== "none" && ["routine", "meal"].includes(event.category) && <span className="ml-1 inline-flex gap-1"><button onClick={() => onOccurrence(event, localDateKey(day), occurrenceStatus(event, day) === "completed" ? "planned" : "completed")} className="underline">{occurrenceStatus(event, day) === "completed" ? "Undo" : "Done"}</button><button onClick={() => onOccurrence(event, localDateKey(day), "skipped")} className="underline">Skip</button></span>}</div>)}</div>
          </div>;
        })}
      </div>
      {!scheduled.length && <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#8a958c]"><CalendarDays size={15} />Add a date to a routine, meal, or appointment to see it here.</div>}
    </section>
  </>;
}
