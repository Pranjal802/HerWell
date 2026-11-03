import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import RecordForm from "../components/RecordForm.jsx";
import RecordList from "../components/RecordList.jsx";

export default function JournalPage({ records, onSave, onDelete, onShare, supporters }) {
  const [form, setForm] = useState(null);
  const [mood, setMood] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const entries = useMemo(() => records.filter((record) => record.category === "journal" && (mood === "all" || record.journal?.mood === mood) && (!from || new Date(record.scheduledAt || record.createdAt) >= new Date(`${from}T00:00:00`)) && (!to || new Date(record.scheduledAt || record.createdAt) <= new Date(`${to}T23:59:59`))), [records, mood, from, to]);
  return <>
    <PageHeader title="My journal" description="A private place for thoughts and reflections. Entries are not shared by default." action={<button onClick={() => setForm({ category: "journal" })} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />New entry</button>} />
    <div className="mb-4 grid gap-3 rounded-xl border border-[#e9ede5] bg-white p-4 sm:grid-cols-3"><label className="text-xs font-semibold text-[#516257]">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8df] px-3 py-2 text-xs" /></label><label className="text-xs font-semibold text-[#516257]">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8df] px-3 py-2 text-xs" /></label><label className="text-xs font-semibold text-[#516257]">Mood<select value={mood} onChange={(event) => setMood(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8df] bg-white px-3 py-2 text-xs"><option value="all">All moods</option><option value="low">A little low</option><option value="okay">Okay</option><option value="good">Good</option></select></label></div>
    <RecordList records={entries} onSave={(item) => setForm(item)} onDelete={onDelete} onShare={onShare} supporters={supporters} searchable emptyTitle="A little room for your story." emptyText="There is no need to write every day. Add a note whenever you like." emptyAction={() => setForm({ category: "journal" })} />
    {form && <RecordForm initial={form} records={records} onClose={() => setForm(null)} onSave={onSave} />}
  </>;
}
