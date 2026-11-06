import { useEffect, useState } from "react";
import { Heart, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";

const choices = [["routines", "Routines"], ["meals", "Meals"], ["reminders", "Reminders"], ["appointments", "Appointments"], ["followups", "Follow-up tasks"], ["notes", "Shared notes and updates"], ["documents", "Documents"]];

export default function SupportersPage({ records, onShare, setNotice }) {
  const [supporters, setSupporters] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState(["routines"]);
  const [error, setError] = useState("");

  async function load() {
    const [active, pending] = await Promise.all([
      api("/supporters"), api("/supporters/invitations"),
    ]);
    setSupporters(active.supporters);
    setInvitations(pending.invitations);
  }
  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, []);

  async function invite(event) {
    event.preventDefault(); setError("");
    try { const result = await api("/supporters/invite", { method: "POST", body: { email, permissions } }); setEmail(""); setNotice(result.message); await load(); }
    catch (inviteError) { setError(inviteError.message); }
  }

  async function updatePermissions(supporter, permission) {
    const selected = supporter.permissions.includes(permission)
      ? supporter.permissions.filter((item) => item !== permission)
      : [...supporter.permissions, permission];
    if (!selected.length) { setError("Choose at least one permitted section. Revoke the invitation to remove all access."); return; }
    try { await api(`/supporters/${supporter._id}`, { method: "PATCH", body: { permissions: selected } }); await load(); }
    catch (updateError) { setError(updateError.message); }
  }

  async function revoke(supporter) {
    if (!window.confirm(`Revoke access for ${supporter.email}?`)) return;
    try { const result = await api(`/supporters/${supporter._id}/revoke`, { method: "POST" }); setNotice(result.message); await load(); }
    catch (revokeError) { setError(revokeError.message); }
  }

  async function invitationAction(tokenOrId, action) {
    const body = tokenOrId?.length === 24 ? { invitationId: tokenOrId } : { token: tokenOrId };
    try { const result = await api(`/supporters/invitations/${action}`, { method: "POST", body }); setNotice(result.message); await load(); }
    catch (actionError) { setError(actionError.message); }
  }

  return <>
    <PageHeader eyebrow="YOU'RE IN CONTROL" title="Supporter access" description="Invite someone you trust. Share only selected records, and revoke access whenever you want." />
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#e5ebe2] bg-[#f1f5ec] p-4 text-xs leading-5 text-[#65756a]"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#4c7555]" />Supporters cannot invite others, change your permissions, or see anything you have not shared individually. Journal notes, wellness check-ins, and documents stay private.</div>
    <form onSubmit={invite} className="mb-7 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#46594b]"><UserPlus size={17} />Invite a trusted person</h2><div className="flex flex-wrap gap-3"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Their email address" className="min-w-60 flex-1 rounded-lg border border-[#e2e8df] px-3 py-2.5 text-sm" /><button className="rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white">Send invitation</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{choices.map(([key, title]) => <label key={key} className="flex items-center gap-2 text-xs text-[#65756a]"><input type="checkbox" checked={permissions.includes(key)} onChange={() => setPermissions((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])} />{title}</label>)}</div>{error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}</form>
    {invitations.length > 0 && <section className="mb-7 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="mb-3 text-sm font-semibold text-[#46594b]">Invitations for you</h2>{invitations.map((invite) => <div key={invite._id} className="flex flex-wrap items-center gap-3 border-t border-[#edf0e9] py-3"><Mail size={17} className="text-[#829087]" /><p className="flex-1 text-xs text-[#65756a]">{invite.owner?.name || "Someone"} invited you to view selected information.</p><button onClick={() => invitationAction(invite._id, "accept")} className="rounded-lg bg-[#edf3ea] px-3 py-2 text-xs font-semibold text-[#45664e]">Accept</button><button onClick={() => invitationAction(invite._id, "reject")} className="rounded-lg px-3 py-2 text-xs text-[#78867d]">Decline</button></div>)}</section>}
    <section className="mb-8 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="mb-3 text-sm font-semibold text-[#46594b]">Your invitations and supporters</h2>{supporters.length ? supporters.map((supporter) => <article key={supporter._id} className="border-t border-[#edf0e9] py-4"><div className="flex flex-wrap items-center gap-2"><Heart size={16} className="text-[#809980]" /><strong className="text-xs text-[#46594b]">{supporter.supporter?.name || supporter.email}</strong><span className="rounded-full bg-[#f1f4ef] px-2 py-1 text-[10px] capitalize text-[#78867d]">{supporter.status}</span><button onClick={() => revoke(supporter)} className="ml-auto text-xs font-semibold text-[#a14d46] hover:underline">Revoke</button></div>{supporter.status === "accepted" && <div className="mt-3 grid gap-2 sm:grid-cols-3">{choices.map(([key, title]) => <label key={key} className="flex items-center gap-2 text-[11px] text-[#65756a]"><input type="checkbox" checked={supporter.permissions.includes(key)} onChange={() => updatePermissions(supporter, key)} />{title}</label>)}</div>}</article>) : <p className="pt-3 text-xs text-[#8b968d]">No supporters invited. Your information stays private.</p>}</section>
  </>;
}
