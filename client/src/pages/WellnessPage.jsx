import { useMemo, useState } from "react";
import { Droplets, Heart, Plus, Sparkles } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import RecordForm from "../components/RecordForm.jsx";
import RecordList from "../components/RecordList.jsx";

export default function WellnessPage({ records, onSave, onDelete }) {
  const [form, setForm] = useState(null);
  const [period, setPeriod] = useState("week");
  const entries = records.filter((record) => ["checkin", "water", "activity"].includes(record.category));
  const chart = useMemo(() => {
    const bucketCount = period === "week" ? 7 : 4;
    const daysPerBucket = period === "week" ? 1 : 7;
    return Array.from({ length: bucketCount }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - ((bucketCount - 1 - index) * daysPerBucket));
      const bucketStart = new Date(date); bucketStart.setHours(0, 0, 0, 0);
      const bucketEnd = new Date(bucketStart); bucketEnd.setDate(bucketEnd.getDate() + daysPerBucket);
      const items = entries.filter((record) => {
        const recordedAt = new Date(record.scheduledAt || record.createdAt);
        return recordedAt >= bucketStart && recordedAt < bucketEnd;
      });
      return {
        day: period === "week" ? new Intl.DateTimeFormat("en", { weekday: "short" }).format(date) : `Week ${index + 1}`,
        checkins: items.filter((record) => record.category === "checkin").length,
        movement: items.filter((record) => record.category === "activity").length,
      };
    });
  }, [entries, period]);
  return <>
    <PageHeader eyebrow="JUST FOR YOU" title="Wellness" description="Optional observations and personal notes, with no scores or interpretations." action={<button onClick={() => setForm({ category: "checkin" })} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264b39]"><Plus size={16} />Check in</button>} />
    <div className="mb-6 grid gap-3 md:grid-cols-3">
      {[["Check-ins", Sparkles, "Optional reflections over time"], ["Movement", Heart, "Notes about activity you enjoyed"], ["Hydration", Droplets, "Water you chose to log"]].map(([title, Icon, description]) => <div key={title} className="rounded-xl border border-[#e9ede5] bg-white p-4"><Icon size={18} className="mb-3 text-[#64826a]" /><h2 className="text-sm font-semibold text-[#46594b]">{title}</h2><p className="mt-1 text-xs text-[#8b968d]">{description}</p></div>)}
    </div>
    <section className="mb-7 rounded-2xl border border-[#e9ede5] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-[Manrope] text-base font-semibold text-[#405347]">Your recorded history</h2><p className="mt-1 text-xs text-[#89958b]">A view of what you recorded—not an assessment.</p></div><div className="flex rounded-lg border border-[#e2e8df] p-1">{[["week", "7 days"], ["month", "28 days"]].map(([value, name]) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-md px-3 py-1.5 text-[10px] ${period === value ? "bg-[#edf3ea] font-semibold text-[#45664e]" : "text-[#78867d]"}`}>{name}</button>)}</div></div><div className={`mt-5 grid gap-2 ${period === "week" ? "grid-cols-7" : "grid-cols-4"}`}>{chart.map((day) => <div key={day.day} className="flex flex-col items-center gap-2"><div className="flex h-24 w-full items-end justify-center gap-1 rounded-lg bg-[#f7f8f4] p-2"><span title={`${day.checkins} check-ins`} className="w-2 rounded-t bg-[#b9cbb5]" style={{ height: `${Math.min(70, 8 + day.checkins * 18)}%` }} /><span title={`${day.movement} movement notes`} className="w-2 rounded-t bg-[#d7c8b7]" style={{ height: `${Math.min(70, 8 + day.movement * 18)}%` }} /></div><span className="text-[10px] text-[#829087]">{day.day}</span></div>)}</div><div className="mt-3 flex gap-4 text-[10px] text-[#829087]"><span>Check-ins</span><span>Movement notes</span></div></section>
    <RecordList records={entries} onSave={(item) => setForm(item)} onDelete={onDelete} emptyTitle="Check in whenever you like." emptyText="There is no requirement to record something every day." emptyAction={() => setForm({ category: "checkin" })} />
    {form && <RecordForm initial={form} records={records} onClose={() => setForm(null)} onSave={onSave} />}
  </>;
}
