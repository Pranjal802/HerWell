import { useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Droplets, Heart, Plus, Salad, Sparkles, Sunrise } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import RecordForm from "../components/RecordForm.jsx";
import RecordList from "../components/RecordList.jsx";
import { occursOn, occurrenceStatus } from "../lib/recurrence.js";
import { localeFor, translate } from "../lib/translations.js";

const today = () => new Date().toDateString();

export default function DashboardPage({ user, records, onSave, onToggle, onSkip, onDelete, onShare, supporters }) {
  const [form, setForm] = useState(null);
  const now = new Date();
  const todays = records.filter((record) => record.recurrence?.frequency && record.recurrence.frequency !== "none"
    ? occursOn(record, new Date())
    : new Date(record.scheduledAt || record.createdAt).toDateString() === today());
  const upcoming = records.filter((record) => ["appointment", "reminder", "followup"].includes(record.category) && record.scheduledAt && new Date(record.scheduledAt) >= new Date(now.setHours(0, 0, 0, 0))).slice(0, 4);
  const completed = todays.filter((record) => occurrenceStatus(record) === "completed").length;
  const water = todays.reduce((sum, record) => sum + (record.category === "water" ? record.amountMl || 0 : 0), 0);
  const openForm = (category) => setForm({ category });

  return <>
    <PageHeader eyebrow="A NEW DAY, YOUR WAY" title={`${translate("Good day,")} ${user.name.split(" ")[0]}.`} description="Take things one step at a time. You're right where you need to be." action={<button onClick={() => openForm("routine")} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264b39]"><Plus size={17} />{translate("Add something")}</button>} />
    <section className="mb-6 grid gap-4 rounded-2xl border border-[#edf0e7] bg-gradient-to-r from-[#f1f5ec] via-[#f8f7ef] to-[#f4f0e8] p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] font-bold tracking-[.14em] text-[#829087]">A GENTLE REMINDER</p><h2 className="mt-2 font-[Manrope] text-xl font-semibold text-[#344a3c]">Small steps are still steps.</h2><p className="mt-1 text-sm text-[#7e8b7e]">There's no rush to do it all. Make today your own.</p></div><div className="flex items-center gap-4"><div className="grid size-14 place-items-center rounded-full border-2 border-[#d5e0d1] text-center text-sm font-bold text-[#46694f]">{completed}<small className="block text-[9px] font-normal">done</small></div><span className="text-xs text-[#7e8b7e]">{todays.length ? "Every little thing counts." : "Your day is yours to shape."}</span></div></section>
    <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button onClick={() => openForm("water")} className="flex items-center gap-3 rounded-xl border border-[#e9ede5] bg-white p-4 text-left hover:border-[#d3dfd1]"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf2f3] text-[#638995]"><Droplets size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[#46594b]">Hydration</strong><small className="mt-1 block text-[11px] text-[#919b92]">{water ? `${water} ml logged today` : "No daily target"}</small></span><Plus size={16} className="text-[#829087]" /></button>
      <button onClick={() => openForm("meal")} className="flex items-center gap-3 rounded-xl border border-[#e9ede5] bg-white p-4 text-left hover:border-[#d3dfd1]"><span className="grid size-10 place-items-center rounded-xl bg-[#f7efe5] text-[#a77c5c]"><Salad size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[#46594b]">Meals & nutrition</strong><small className="mt-1 block text-[11px] text-[#919b92]">Plan meals and save food notes</small></span><Plus size={16} className="text-[#829087]" /></button>
      <button onClick={() => openForm("activity")} className="flex items-center gap-3 rounded-xl border border-[#e9ede5] bg-white p-4 text-left hover:border-[#d3dfd1]"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2e8] text-[#66836a]"><Heart size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[#46594b]">Movement</strong><small className="mt-1 block text-[11px] text-[#919b92]">Record movement you enjoyed</small></span><Plus size={16} className="text-[#829087]" /></button>
      <button onClick={() => openForm("checkin")} className="flex items-center gap-3 rounded-xl border border-[#e9ede5] bg-white p-4 text-left hover:border-[#d3dfd1]"><span className="grid size-10 place-items-center rounded-xl bg-[#efeff5] text-[#797898]"><Sparkles size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[#46594b]">Wellness check-in</strong><small className="mt-1 block text-[11px] text-[#919b92]">Optional, private reflection</small></span><Plus size={16} className="text-[#829087]" /></button>
    </section>
    <div className="grid gap-8 xl:grid-cols-[1.4fr_.8fr]">
      <section><div className="mb-3 flex items-end justify-between border-b border-[#e9ece5] pb-3"><div><p className="text-[10px] font-bold tracking-[.14em] text-[#829087]">A LITTLE AT A TIME</p><h2 className="mt-1 font-[Manrope] text-lg font-semibold text-[#304337]">Your day <span className="ml-1 rounded-full bg-[#eef1eb] px-2 py-1 text-xs font-medium text-[#809083]">{todays.length}</span></h2></div><Link to="/planner" className="flex items-center gap-1 text-xs font-semibold text-[#62816a]">My planner <ArrowRight size={14} /></Link></div>
        <RecordList records={todays.slice(0, 6)} onSave={(item) => setForm(item)} onToggle={onToggle} onSkip={onSkip} onDelete={onDelete} onShare={onShare} supporters={supporters} emptyTitle="A little room to begin." emptyText="Add a routine, a meal, or anything you'd like to remember." emptyAction={() => openForm("routine")} />
      </section>
      <section><div className="mb-3 flex items-end justify-between border-b border-[#e9ece5] pb-3"><div><p className="text-[10px] font-bold tracking-[.14em] text-[#829087]">LOOKING AHEAD</p><h2 className="mt-1 font-[Manrope] text-lg font-semibold text-[#304337]">Coming up</h2></div><Link to="/calendar" className="flex items-center gap-1 text-xs font-semibold text-[#62816a]">Calendar <ArrowRight size={14} /></Link></div>
        {upcoming.length ? <div className="rounded-2xl border border-[#e9ede5] bg-white px-4">{upcoming.map((item) => <div key={item._id} className="flex gap-3 border-b border-[#edf0e9] py-4 last:border-0"><span className="grid size-9 place-items-center rounded-xl bg-[#eeedf5] text-[#797898]"><CalendarDays size={17} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#46594b]">{item.title}</strong><small className="mt-1 flex items-center gap-1 text-[10px] text-[#8d9990]"><Clock3 size={12} />{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.scheduledAt))}</small></span></div>)}</div> : <div className="rounded-2xl border border-[#e9ede5] bg-white p-6 text-sm text-[#8a958c]">No upcoming reminders or appointments.</div>}
        <div className="mt-4 grid grid-cols-2 gap-3"><Link to="/meals" className="rounded-xl border border-[#e9ede5] bg-white p-4 text-xs font-semibold text-[#52665a]"><Salad className="mb-2 text-[#a77c5c]" size={17} />Meals</Link><Link to="/wellness" className="rounded-xl border border-[#e9ede5] bg-white p-4 text-xs font-semibold text-[#52665a]"><Check className="mb-2 text-[#66836a]" size={17} />Wellness</Link></div>
      </section>
    </div>
    {form && <RecordForm initial={form} records={records} onClose={() => setForm(null)} onSave={onSave} />}
  </>;
}
