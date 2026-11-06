import { useEffect, useMemo, useState } from "react";
import { Download, FileUp, RotateCcw } from "lucide-react";
import { api } from "../lib/api.js";
import { parseImportFiles } from "../lib/importExport.js";

const typeNames = {
  routine: "routines",
  meal: "meals",
  reminder: "reminders",
  checkin: "daily check-ins",
  appointment: "appointments",
  journal: "journal entries",
};
const sectionNames = {
  routine: "Routines",
  meal: "Meals",
  reminder: "Reminders",
  checkin: "Daily check-ins",
  appointment: "Appointments",
  journal: "Journal entries",
};
const button = "rounded-lg border border-[#dbe5d9] px-3 py-2 text-xs font-semibold text-[#57745e] disabled:opacity-50";

function importedSummary(counts, skipped) {
  const imported = Object.entries(counts).filter(([, count]) => count > 0).map(([category, count]) => `${count} ${typeNames[category]}`);
  return `Imported ${imported.length ? imported.join(", ") : "0 records"}. ${skipped} skipped.`;
}

export default function ImportExportPanel({ timeZone = "UTC", setNotice }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [importSkipped, setImportSkipped] = useState([]);
  const [undoId, setUndoId] = useState("");
  const [undoExpires, setUndoExpires] = useState("");

  useEffect(() => {
    api("/records/import/undo/latest").then(({ backup }) => {
      if (backup) { setUndoId(backup._id); setUndoExpires(backup.expiresAt); }
    }).catch((loadError) => setError(loadError.message));
  }, []);

  const counts = useMemo(() => {
    const result = Object.fromEntries(Object.keys(typeNames).map((category) => [category, 0]));
    for (const entry of preview?.entries || []) result[entry.category] += 1;
    return result;
  }, [preview]);

  async function prepare(event) {
    const selected = [...(event.target.files || [])];
    setFiles(selected);
    setPreview(null);
    setSummary("");
    setImportSkipped([]);
    setError("");
    if (!selected.length) return;
    try { setPreview(await parseImportFiles(selected, timeZone)); }
    catch (parseError) { setError(parseError.message); }
  }

  async function exportRecords() {
    setBusy(true); setError("");
    try {
      const blob = await api("/records/export", { download: true });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "herwell-records.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) { setError(exportError.message); }
    finally { setBusy(false); }
  }

  async function importRecords() {
    if (!preview) return;
    if (mode === "replace" && !window.confirm("Replace existing records in the included sections? You can undo this for 30 days.")) return;
    setBusy(true); setError(""); setSummary("");
    try {
      const result = await api("/records/import", {
        method: "POST",
        body: { rows: preview.entries, categories: preview.categories, mode },
      });
      setUndoId(result.backupId);
      setUndoExpires(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      setImportSkipped(result.skipped);
      const skipped = preview.problems.length + result.skipped.length;
      setSummary(importedSummary(result.counts, skipped));
      window.dispatchEvent(new Event("herwell:records-updated"));
      setNotice(importedSummary(result.counts, skipped));
    } catch (importError) { setError(importError.message); }
    finally { setBusy(false); }
  }

  async function undoImport() {
    if (!undoId) return;
    setBusy(true); setError("");
    try {
      await api("/records/import/undo", { method: "POST", body: { backupId: undoId } });
      setUndoId(""); setUndoExpires("");
      setSummary("The import was undone.");
      window.dispatchEvent(new Event("herwell:records-updated"));
      setNotice("Import undone.");
      const { backup } = await api("/records/import/undo/latest");
      if (backup) { setUndoId(backup._id); setUndoExpires(backup.expiresAt); }
    } catch (undoError) { setError(undoError.message); }
    finally { setBusy(false); }
  }

  const canImport = Boolean(preview && preview.categories.length
    && (preview.entries.length || mode === "replace")
    && preview.entries.length <= 5000
    && !preview.problems.some((problem) => problem.startsWith("JSON version") || problem.startsWith("JSON file") || problem.startsWith("JSON timezone")));

  return <section className="mb-6 rounded-2xl border border-[#e9ede5] bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-sm font-semibold text-[#46594b]">Import and export records</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#8b968d]">JSON and CSV files are read in this browser. Records are saved to your HerWell account; file contents are not sent to any third-party service. PDF uploads remain in Documents and are not automatically parsed.</p></div>
      <button type="button" disabled={busy} onClick={exportRecords} className={button}><Download className="mr-1 inline" size={14} />Export JSON</button>
    </div>
    <div className="mt-4 grid gap-4">
      <label className="text-xs font-semibold text-[#516257]">Choose JSON or CSV file(s)
        <input type="file" accept=".json,.csv,application/json,text/csv" multiple onChange={prepare} className="mt-2 block w-full text-xs text-[#65756a] file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf3ea] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#45664e]" />
      </label>
      <p className="text-[11px] leading-5 text-[#89958b]">JSON uses version 1 and the sections routines, meals, reminders, checkins, appointments, and journal. CSV accepts one type per file (for example reminders.csv) or a type column. Date-time fields use YYYY-MM-DDTHH:mm in the file timezone.</p>
      {preview && <div className="rounded-xl border border-[#e9ede5] bg-[#fafbf8] p-4">
        <h3 className="text-xs font-semibold text-[#46594b]">Preview · {files.map((file) => file.name).join(", ")}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(counts).filter(([category]) => preview.categories.includes(category)).map(([category, count]) => <p key={category} className="rounded-lg bg-white px-3 py-2 text-xs text-[#65756a]">{sectionNames[category]} <strong className="float-right text-[#45664e]">{count}</strong></p>)}
        </div>
        {preview.entries.length > 0 && <div className="mt-3 text-xs text-[#65756a]"><strong>Sample rows</strong><ul className="mt-1 space-y-1">{preview.entries.slice(0, 5).map((entry) => <li key={entry._source}>{sectionNames[entry.category]} · {entry.title} {entry.scheduledAt ? `· ${entry.scheduledAt.slice(0, 16).replace("T", " ")}` : ""}</li>)}</ul></div>}
        {preview.problems.length > 0 && <div className="mt-3 text-xs text-[#9a5646]"><strong>Problems ({preview.problems.length})</strong><ul className="mt-1 max-h-36 list-inside list-disc space-y-1 overflow-y-auto">{preview.problems.slice(0, 30).map((problem, index) => <li key={`${index}-${problem}`}>{problem}</li>)}</ul>{preview.problems.length > 30 && <p className="mt-1">And {preview.problems.length - 30} more.</p>}</div>}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-[#516257]">Import mode<select value={mode} onChange={(event) => setMode(event.target.value)} className="mt-1 block rounded-lg border border-[#e2e8df] bg-white px-3 py-2 text-xs"><option value="merge">Merge (default; skip duplicates)</option><option value="replace">Replace rows in included sections</option></select></label>
          <button type="button" disabled={busy || !canImport} onClick={importRecords} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><FileUp size={15} />{busy ? "Importing…" : "Import valid rows"}</button>
        </div>
        {mode === "replace" && <p className="mt-2 text-[11px] leading-5 text-[#9a6d38]">Replace removes existing records only for sections included in this file. You can undo this import for 30 days.</p>}
      </div>}
      {summary && <p role="status" className="rounded-lg bg-[#edf3ea] p-3 text-xs font-semibold text-[#45664e]">{summary}</p>}
      {importSkipped.length > 0 && <div className="rounded-lg border border-[#f0dfdc] p-3 text-xs text-[#9a5646]"><strong>Rows skipped during import</strong><ul className="mt-1 max-h-36 list-inside list-disc space-y-1 overflow-y-auto">{importSkipped.slice(0, 30).map((item, index) => <li key={`${index}-${item.source}`}>{item.source}: {item.reason}</li>)}</ul>{importSkipped.length > 30 && <p className="mt-1">And {importSkipped.length - 30} more.</p>}</div>}
      {undoId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e9ede5] p-3"><p className="text-xs text-[#65756a]">An import backup is available until {undoExpires ? new Date(undoExpires).toLocaleDateString() : "30 days after import"}.</p><button type="button" disabled={busy} onClick={undoImport} className={button}><RotateCcw className="mr-1 inline" size={14} />Undo latest import</button></div>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  </section>;
}
