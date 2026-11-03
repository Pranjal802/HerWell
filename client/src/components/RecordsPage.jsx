import { useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "./PageHeader.jsx";
import RecordList from "./RecordList.jsx";
import RecordForm from "./RecordForm.jsx";

export default function RecordsPage({ title, description, category, records, onSave, onToggle, onSkip, onDelete, onShare, supporters, searchable = false }) {
  const [adding, setAdding] = useState(false);
  const categories = Array.isArray(category) ? category : [category];
  const items = records.filter((record) => categories.includes(record.category));
  const create = () => setAdding({ category: categories[0] });
  return <>
    <PageHeader title={title} description={description} action={<button onClick={create} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264b39]"><Plus size={17} />Add something</button>} />
    {title === "Reminders" && <div className="mb-5 rounded-xl border border-[#e5ebe2] bg-white p-4 text-xs leading-5 text-[#738176]">Reminders are saved in your account. Device notifications depend on browser support and permission.</div>}
    <RecordList records={items} onSave={onSave} onToggle={onToggle} onSkip={onSkip} onDelete={onDelete} onShare={onShare} supporters={supporters} searchable={searchable} emptyTitle={`A little room for ${title.toLowerCase()}.`} emptyText="Create a private entry whenever it feels useful." emptyAction={create} />
    {adding && <RecordForm initial={adding} records={records} onClose={() => setAdding(false)} onSave={onSave} />}
  </>;
}
