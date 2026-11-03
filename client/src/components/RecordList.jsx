import { useState } from "react";
import { BookHeart, CalendarDays, Check, Clock3, Droplets, Heart, Pencil, Plus, Salad, Sparkles, Sunrise, Trash2 } from "lucide-react";
import RecordForm from "./RecordForm.jsx";
import { occurrenceStatus } from "../lib/recurrence.js";
import { localeFor, translate } from "../lib/translations.js";

const icons = { routine: Sunrise, meal: Salad, reminder: Clock3, followup: Check, appointment: CalendarDays, journal: BookHeart, activity: Heart, water: Droplets, checkin: Sparkles };
const style = { routine: "bg-[#eaf1e8] text-[#64826a]", meal: "bg-[#f7eee3] text-[#b3835e]", reminder: "bg-[#eaf2f3] text-[#638995]", followup: "bg-[#edf2e8] text-[#66836a]", appointment: "bg-[#eeedf5] text-[#797898]", journal: "bg-[#f6ebea] text-[#a77873]", activity: "bg-[#edf2e8] text-[#66836a]", water: "bg-[#eaf2f3] text-[#638995]", checkin: "bg-[#efeff5] text-[#797898]" };

function MealPhoto({ recordId }) {
  const [available, setAvailable] = useState(true);
  return available ? <img src={`/api/documents/meals/${recordId}/image`} alt="" className="mt-2 max-h-36 max-w-48 rounded-xl object-cover" onError={() => setAvailable(false)} /> : null;
}

function RecordCard({ item, onToggle, onSkip, onDelete, onShare, supporters, onSave }) {
  const Icon = icons[item.category] || CalendarDays;
  const canComplete = ["routine", "meal", "appointment", "reminder", "followup"].includes(item.category);
  const completed = occurrenceStatus(item) === "completed";
  const time = item.scheduledAt && new Intl.DateTimeFormat(localeFor(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.scheduledAt));
  const permissionForCategory = { routine: "routines", meal: "meals", reminder: "reminders", appointment: "appointments", followup: "followups", journal: "notes" };
  const permittedSupporters = supporters?.filter((supporter) => supporter.permissions.includes(permissionForCategory[item.category]));
  const [shareTarget, setShareTarget] = useState("");
  return <article className="group flex gap-3 border-b border-[#edf0e9] py-4">
    {canComplete ? <button onClick={() => onToggle(item)} aria-label={translate(completed ? "Mark as not done" : "Mark as done")} className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${style[item.category]} ${completed ? "opacity-60" : ""}`}>{completed ? <Check size={18} /> : <Icon size={18} />}</button> : <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${style[item.category]}`}><Icon size={18} /></span>}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={`text-sm font-semibold text-[#405347] ${completed ? "line-through opacity-60" : ""}`}>{item.title}</h3>{time && <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-[#8d9990]"><Clock3 size={13} />{time}</span>}</div>
      <p className="mt-1 text-xs text-[#8b968d]">{[item.categoryLabel, item.mealType, item.appointment?.provider, item.amountMl && `${item.amountMl} ml`, item.durationMinutes && `${item.durationMinutes} min`].filter(Boolean).join(" · ") || item.category}</p>
      {item.ingredients && <p className="mt-1 text-xs text-[#718074]">Ingredients: {item.ingredients}</p>}
      {item.category === "meal" && item.mealImageFileId && <MealPhoto key={item.mealImageFileId} recordId={item._id} />}
      {item.appointment?.location && <p className="mt-1 text-xs text-[#718074]">{item.appointment.location}</p>}
      {item.recurrence?.frequency && item.recurrence.frequency !== "none" && <p className="mt-1 text-[10px] capitalize text-[#839187]">{translate(item.recurrence.frequency)}{item.recurrence.interval > 1 ? ` · ${translate("every")} ${item.recurrence.interval}` : ""}</p>}
      {item.notes && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#818e84]">{item.notes}</p>}
      {item.supporterUpdates?.length > 0 && <div className="mt-2 space-y-1 border-l-2 border-[#dce7d8] pl-2">{item.supporterUpdates.map((update, index) => <p key={`${update.createdAt}-${index}`} className="text-[10px] leading-4 text-[#718074]"><span className="font-semibold">{update.author?.name || "Supporter"}:</span> {update.note}</p>)}</div>}
      {item.completionHistory?.length > 0 && <p className="mt-1 text-[10px] text-[#87948a]">{item.completionHistory.length} update{item.completionHistory.length === 1 ? "" : "s"} recorded</p>}
    </div>
    <div className="flex shrink-0 items-start gap-1">
      {onShare && permittedSupporters?.length > 0 && <select aria-label="Share with supporter" value={shareTarget} onChange={async (event) => { const id = event.target.value; if (id) await onShare(item, id); setShareTarget(""); }} className="max-w-28 rounded border border-[#e4e9e1] bg-white px-1 py-1 text-[10px] text-[#718074]"><option value="" disabled>Share…</option>{permittedSupporters.map((supporter) => <option key={supporter._id} value={supporter.supporter?._id || supporter.supporter}>{(item.sharedWith || []).includes(supporter.supporter?._id || supporter.supporter) ? "Stop sharing · " : ""}{supporter.supporter?.name || supporter.email}</option>)}</select>}
      <button onClick={() => onSave(item)} className="rounded-lg p-2 text-[#87948a] hover:bg-[#f3f6f1] hover:text-[#45664e]" aria-label={`Edit ${item.title}`}><Pencil size={15} /></button>
      {item.category === "routine" && item.status !== "skipped" && <button onClick={() => onSkip(item)} className="rounded-lg px-2 py-1 text-[10px] text-[#78867d] hover:bg-[#f3f6f1]" aria-label={`${translate("Skip")} ${item.title}`}>{translate("Skip")}</button>}
      <button onClick={() => onDelete(item)} className="rounded-lg p-2 text-[#87948a] hover:bg-[#fbefed] hover:text-[#a14d46]" aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button>
    </div>
  </article>;
}

export default function RecordList({ records, onToggle, onSkip, onDelete, onSave, onShare, supporters, emptyTitle = "Nothing here just yet.", emptyText = "Add something whenever you're ready. There's no rush.", emptyAction, searchable = false }) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const visible = records.filter((record) => !query || `${record.title} ${record.notes} ${record.ingredients || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <section>
    {searchable && <input className="mb-3 w-full rounded-lg border border-[#e2e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#9db59e] sm:max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate("Search your journal…")} aria-label={translate("Search records")} />}
    <div className="rounded-2xl border border-[#e9ede5] bg-white px-4">
      {visible.length ? visible.map((item) => <RecordCard key={item._id} item={item} onToggle={onToggle} onSkip={onSkip} onDelete={onDelete} onShare={onShare} supporters={supporters} onSave={setEditing} />) : <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="mb-3 grid size-14 place-items-center rounded-full bg-[#edf2e9] text-[#809980]"><BookHeart size={25} /></span><h3 className="font-[Manrope] text-base font-semibold text-[#44594a]">{translate(emptyTitle)}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-[#8a958c]">{translate(emptyText)}</p>{emptyAction && <button onClick={emptyAction} className="mt-4 flex items-center gap-2 rounded-lg border border-[#dbe5d9] bg-white px-3 py-2 text-xs font-semibold text-[#57745e] hover:bg-[#f5f8f3]"><Plus size={15} />{translate("Add your first item")}</button>}</div>}
    </div>
    {editing && <RecordForm initial={editing} records={records} onClose={() => setEditing(null)} onSave={onSave} />}
  </section>;
}
