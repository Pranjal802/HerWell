import { useEffect, useState } from "react";
import { FileText, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";

export default function DocumentsPage({ setNotice }) {
  const [documents, setDocuments] = useState([]);
  const [supporters, setSupporters] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("report");
  const [documentDate, setDocumentDate] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [own, active] = await Promise.all([api("/documents"), api("/supporters")]);
    setDocuments(own.documents);
    setSupporters(active.supporters.filter((item) => item.status === "accepted" && item.permissions.includes("documents")));
  }
  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, []);

  async function upload(event) {
    event.preventDefault();
    setBusy(true); setError("");
    const body = new FormData();
    body.append("file", file);
    body.append("title", title);
    body.append("description", description);
    body.append("category", category);
    if (documentDate) body.append("documentDate", documentDate);
    try {
      await api("/documents", { method: "POST", body });
      setTitle(""); setDescription(""); setFile(null); setDocumentDate("");
      event.target.reset();
      await load();
      setNotice("Private document uploaded.");
    } catch (uploadError) { setError(uploadError.message); }
    finally { setBusy(false); }
  }

  async function remove(document) {
    if (!window.confirm(`Permanently delete "${document.title}"?`)) return;
    try { await api(`/documents/${document._id}`, { method: "DELETE" }); setDocuments((items) => items.filter((item) => item._id !== document._id)); setNotice("Private document deleted."); }
    catch (deleteError) { setError(deleteError.message); }
  }

  async function toggleShare(document, supporterId) {
    const share = !(document.sharedWith || []).includes(supporterId);
    try {
      await api(`/supporters/documents/${document._id}/share`, { method: "POST", body: { supporterId, share } });
      await load();
      setNotice(share ? "Document shared with your supporter." : "Document sharing stopped.");
    } catch (shareError) { setError(shareError.message); }
  }

  const visibleDocuments = documents.filter((document) => (filter === "all" || document.category === filter)
    && `${document.title} ${document.description || ""} ${document.filename}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    <PageHeader eyebrow="PRIVATE BY DEFAULT" title="Documents" description="Keep medical documents in your private space. Only PDF, JPEG, and PNG files up to 10 MB are accepted." />
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#e5ebe2] bg-[#f1f5ec] p-4 text-xs leading-5 text-[#65756a]"><LockKeyhole className="mt-0.5 shrink-0 text-[#4c7555]" size={17} />Files are stored in private MongoDB GridFS and streamed only after account access checks. They are private unless you choose to share them with a supporter.</div>
    <form onSubmit={upload} className="mb-8 grid gap-4 rounded-2xl border border-[#e9ede5] bg-white p-5 sm:grid-cols-2">
      <label className="text-xs font-semibold text-[#516257]">Document title<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8df] px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-[#516257]">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8df] bg-white px-3 py-2.5 text-sm"><option value="report">Medical report</option><option value="prescription">Prescription</option><option value="test-result">Test result</option><option value="other">Other</option></select></label>
      <label className="text-xs font-semibold text-[#516257]">Document date<input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8df] px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-[#516257]">Choose file<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-[#65756a] file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf3ea] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#45664e]" /></label>
      <label className="text-xs font-semibold text-[#516257] sm:col-span-2">Description<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} rows="2" className="mt-1 w-full rounded-lg border border-[#e2e8df] px-3 py-2.5 text-sm" /></label>
      {error && <p role="alert" className="text-xs text-red-700 sm:col-span-2">{error}</p>}
      <button disabled={busy || !file} className="flex w-fit items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16} />{busy ? "Uploading…" : "Upload privately"}</button>
    </form>
    <section className="overflow-hidden rounded-2xl border border-[#e9ede5] bg-white">
      <div className="flex flex-wrap gap-2 border-b border-[#edf0e9] p-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" aria-label="Search documents" className="min-w-52 flex-1 rounded-lg border border-[#e2e8df] px-3 py-2 text-xs" /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by category" className="rounded-lg border border-[#e2e8df] bg-white px-3 py-2 text-xs"><option value="all">All categories</option><option value="report">Reports</option><option value="prescription">Prescriptions</option><option value="test-result">Test results</option><option value="other">Other</option></select></div>
      {visibleDocuments.length ? visibleDocuments.map((document) => <article key={document._id} className="flex flex-wrap items-center gap-3 border-b border-[#edf0e9] p-4 last:border-0"><span className="grid size-10 place-items-center rounded-xl bg-[#eeedf5] text-[#797898]"><FileText size={18} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-[#46594b]">{document.title}</h2><p className="mt-1 text-xs text-[#8b968d]">{document.category} · {(document.size / 1024 / 1024).toFixed(1)} MB {document.documentDate && `· ${new Date(document.documentDate).toLocaleDateString()}`}</p></div><a href={`/api/documents/${document._id}/file?preview=true`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#dbe5d9] px-3 py-2 text-xs font-semibold text-[#57745e]">Preview</a><a href={`/api/documents/${document._id}/file`} className="rounded-lg bg-[#edf3ea] px-3 py-2 text-xs font-semibold text-[#45664e]">Download</a>{supporters.length > 0 && <select aria-label={`Share ${document.title}`} value="" onChange={(event) => event.target.value && toggleShare(document, event.target.value)} className="max-w-32 rounded-lg border border-[#e2e8df] bg-white px-2 py-2 text-[10px] text-[#57745e]"><option value="" disabled>Share…</option>{supporters.map((supporter) => <option key={supporter._id} value={supporter.supporter?._id}>{(document.sharedWith || []).includes(supporter.supporter?._id) ? "Stop sharing · " : ""}{supporter.supporter?.name || supporter.email}</option>)}</select>}<button aria-label={`Delete ${document.title}`} onClick={() => remove(document)} className="rounded-lg p-2 text-[#87948a] hover:bg-[#fbefed] hover:text-[#a14d46]"><Trash2 size={16} /></button></article>) : <div className="p-8 text-center text-sm text-[#8a958c]">{documents.length ? "No documents match those filters." : "No documents yet. Upload one when you're ready."}</div>}
    </section>
  </>;
}
