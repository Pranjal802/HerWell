import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, FileText, Heart, RefreshCw } from "lucide-react";
import { api } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";
import { localDateKey, occurrenceStatus } from "../lib/recurrence.js";

function formatSchedule(record) {
  const date = record.scheduledAt || record.startsAt;
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "";
}

export default function SharedWithMePage() {
  const [records, setRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [sharedRecords, sharedDocuments] = await Promise.all([
      api("/supporters/shared/records"),
      api("/supporters/shared/documents"),
    ]);
    setRecords(sharedRecords.records);
    setDocuments(sharedDocuments.documents);
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setBusy(false));
  }, []);

  async function updateRoutine(record) {
    setError("");
    try {
      const body = { completed: occurrenceStatus(record) !== "completed" };
      if (record.recurrence?.frequency !== "none") body.occurrenceKey = localDateKey(new Date());
      await api(`/supporters/shared/records/${record._id}`, { method: "PATCH", body });
      await load();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function addNote(event, record) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = new FormData(form).get("note");
    setError("");
    try {
      await api(`/supporters/shared/records/${record._id}`, { method: "PATCH", body: { note } });
      form.reset();
      await load();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  const hasSharedItems = records.length > 0 || documents.length > 0;

  return <>
    <PageHeader
      eyebrow="SHARED WITH YOU"
      title="Shared with me"
      description="View schedules, notes, and documents other people have chosen to share with you."
      action={<button onClick={() => { setBusy(true); load().catch((loadError) => setError(loadError.message)).finally(() => setBusy(false)); }} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dbe5d9] bg-white px-3 py-2 text-sm font-semibold text-[#57745e] disabled:opacity-60"><RefreshCw size={16} />Refresh</button>}
    />

    {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {busy && <p role="status" className="mb-5 text-sm text-[#718074]">Loading shared items…</p>}
    {!busy && !error && !hasSharedItems && <div className="rounded-2xl border border-dashed border-[#d5dce6] bg-white p-8 text-center">
      <Heart size={28} className="mx-auto mb-3 text-[#809980]" />
      <h2 className="text-base font-semibold text-[#405347]">Nothing has been shared with you yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718074]">When someone shares a schedule item or document, it will appear here. Accepting a supporter invitation does not automatically share their information.</p>
    </div>}

    {records.length > 0 && <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#405347]"><CalendarDays size={18} />Shared schedules and notes</h2>
      <div className="overflow-hidden rounded-2xl border border-[#e2e8df] bg-white px-4">
        {records.map((record) => {
          const schedule = formatSchedule(record);
          return <article key={record._id} className="border-b border-[#edf0e9] py-4 last:border-0">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[#405347]">{record.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs capitalize text-[#78867d]">
                  <span>{record.category}</span>
                  {record.sharedBy && <span>· Shared by {record.sharedBy}</span>}
                  {schedule && <span className="inline-flex items-center gap-1"><Clock3 size={13} />{schedule}</span>}
                  {record.recurrence?.frequency && record.recurrence.frequency !== "none" && <span>· {record.recurrence.frequency}</span>}
                </p>
                {record.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-[#65756a]">{record.notes}</p>}
                {record.supporterUpdates?.map((update, index) => <p key={`${update.createdAt}-${index}`} className="mt-2 border-l-2 border-[#dce7d8] pl-3 text-xs leading-5 text-[#65756a]"><strong>{update.author?.name || "Supporter"}:</strong> {update.note}</p>)}
              </div>
              {record.category === "routine" && <button onClick={() => updateRoutine(record)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[#dbe5d9] px-3 py-2 text-xs font-semibold text-[#57745e]">
                <Check size={15} />{occurrenceStatus(record) === "completed" ? "Mark not done" : "Mark done"}
              </button>}
            </div>
            {record.canAddNote && <form onSubmit={(event) => addNote(event, record)} className="mt-3 flex flex-wrap gap-2">
              <input name="note" maxLength={1000} required placeholder="Add a note for the owner" className="min-w-48 flex-1 rounded-lg border border-[#e2e8df] px-3 py-2 text-xs" />
              <button className="rounded-lg bg-[#edf3ea] px-3 py-2 text-xs font-semibold text-[#45664e]">Send note</button>
            </form>}
          </article>;
        })}
      </div>
    </section>}

    {documents.length > 0 && <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#405347]"><FileText size={18} />Shared documents</h2>
      <div className="overflow-hidden rounded-2xl border border-[#e2e8df] bg-white">
        {documents.map((document) => <article key={document._id} className="flex flex-wrap items-center gap-3 border-b border-[#edf0e9] p-4 last:border-0">
          <FileText size={18} className="shrink-0 text-[#797898]" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[#405347]">{document.title}</h3>
            <p className="mt-1 text-xs text-[#78867d]">{document.category}{document.sharedBy ? ` · Shared by ${document.sharedBy}` : ""}{document.documentDate ? ` · ${new Date(document.documentDate).toLocaleDateString()}` : ""}</p>
          </div>
          <a href={`/api/documents/${document._id}/file?preview=true`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#dbe5d9] px-3 py-2 text-xs font-semibold text-[#57745e]">View</a>
          <a href={`/api/documents/${document._id}/file`} className="rounded-lg bg-[#edf3ea] px-3 py-2 text-xs font-semibold text-[#45664e]">Download</a>
        </article>)}
      </div>
    </section>}
  </>;
}
