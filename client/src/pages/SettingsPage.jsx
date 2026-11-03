import { useState } from "react";
import { Download, LockKeyhole, Save, Trash2, Upload } from "lucide-react";
import { api } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";
import { translate } from "../lib/translations.js";

export default function SettingsPage({ user, setUser, setNotice }) {
  const [profile, setProfile] = useState({ name: user.name || "", ...(user.profile || {}) });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "mt-1 w-full rounded-lg border border-[#e2e8df] bg-white px-3 py-2.5 text-sm text-[#33473a] outline-none focus:border-[#9db59e]";

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { user: updated } = await api("/auth/profile", { method: "PATCH", body: profile }); document.documentElement.lang = updated.profile?.language === "es" ? "es" : "en"; setUser(updated); setProfile({ name: updated.name, ...updated.profile }); setNotice("Profile and preferences saved."); }
    catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await api("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }); setNotice(result.message); setCurrentPassword(""); setNewPassword(""); }
    catch (changeError) { setError(changeError.message); }
    finally { setBusy(false); }
  }

  async function requestEmailChange(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api("/auth/change-email/request", { method: "POST", body: { email: newEmail, password: emailPassword } });
      setNotice(result.message); setNewEmail(""); setEmailPassword("");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData(); body.append("file", file);
    try { const result = await api("/documents/avatar", { method: "POST", body }); setNotice(result.message); window.dispatchEvent(new Event("herwell:avatar-updated")); }
    catch (uploadError) { setError(uploadError.message); }
  }

  async function removeAvatar() {
    try { const result = await api("/documents/avatar", { method: "DELETE" }); setNotice(result.message); window.dispatchEvent(new Event("herwell:avatar-updated")); }
    catch (removeError) { setError(removeError.message); }
  }

  async function exportData() {
    try {
      const blob = await api("/auth/export", { download: true });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "herwell-export.json"; anchor.click(); URL.revokeObjectURL(url);
    } catch (exportError) { setError(exportError.message); }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (!window.confirm("This permanently deletes your account and private records. Continue?")) return;
    try { await api("/auth/account", { method: "DELETE", body: { password: deletePassword } }); setUser(null); window.location.assign("/"); }
    catch (deleteError) { setError(deleteError.message); }
  }

  return <>
    <PageHeader title="Settings" description="Your profile, preferences, and account privacy." />
    {error && <p role="alert" className="mb-4 rounded-lg bg-[#fbefed] p-3 text-sm text-[#a94841]">{error}</p>}
    <form onSubmit={saveProfile} className="mb-6 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-[#46594b]"><LockKeyhole size={17} />Personal details and preferences</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-[#516257]">{translate("Name")}<input required maxLength={60} className={field} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Email address")}<input disabled className={`${field} bg-[#f4f6f2]`} value={user.email} /></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Date of birth")}<input type="date" className={field} value={profile.dateOfBirth?.slice?.(0, 10) || ""} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })} /></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Phone")}<input maxLength={32} className={field} value={profile.phone || ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Time zone")}<input maxLength={80} className={field} value={profile.timeZone || "UTC"} onChange={(event) => setProfile({ ...profile, timeZone: event.target.value })} /></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Language")}<select className={field} value={profile.language || "en"} onChange={(event) => setProfile({ ...profile, language: event.target.value })}><option value="en">{translate("English")}</option><option value="es">{translate("Español")}</option></select></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Theme")}<select className={field} value={profile.theme || "system"} onChange={(event) => setProfile({ ...profile, theme: event.target.value })}><option value="system">{translate("System")}</option><option value="light">{translate("Light")}</option><option value="dark">{translate("Dark")}</option></select></label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-[#65756a]"><input type="checkbox" checked={profile.notificationsEnabled !== false} onChange={(event) => setProfile({ ...profile, notificationsEnabled: event.target.checked })} />{translate("In-app notifications enabled")}</label>
      <label className="flex items-start gap-2 text-xs leading-5 text-[#65756a]"><input className="mt-1" type="checkbox" checked={profile.hideAppointmentDetailsOnDashboard !== false} onChange={(event) => setProfile({ ...profile, hideAppointmentDetailsOnDashboard: event.target.checked })} /><span>{translate("Show appointment titles on Today")}</span></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Quiet hours start")}<input type="time" className={field} value={profile.quietHoursStart || ""} onChange={(event) => setProfile({ ...profile, quietHoursStart: event.target.value })} /></label>
      <label className="text-xs font-semibold text-[#516257]">{translate("Quiet hours end")}<input type="time" className={field} value={profile.quietHoursEnd || ""} onChange={(event) => setProfile({ ...profile, quietHoursEnd: event.target.value })} /></label>
    </div><button disabled={busy} className="mt-5 flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} />{translate("Save preferences")}</button></form>
    <form onSubmit={requestEmailChange} className="mb-6 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="text-sm font-semibold text-[#46594b]">{translate("Change email address")}</h2><p className="mt-1 text-xs text-[#8b968d]">{translate("We’ll send a confirmation link to the new address. Your current email stays active until you confirm.")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder={translate("New email address")} className={field} /><input type="password" autoComplete="current-password" required value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} placeholder={translate("Confirm your current password")} className={field} /></div><button disabled={busy} className="mt-3 rounded-lg bg-[#edf3ea] px-4 py-2 text-xs font-semibold text-[#45664e] disabled:opacity-60">{translate("Send confirmation email")}</button></form>
    <section className="mb-6 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="text-sm font-semibold text-[#46594b]">Profile picture</h2><p className="mt-1 text-xs text-[#8b968d]">JPEG or PNG, up to 5 MB.</p><div className="mt-3 flex gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#dbe5d9] px-3 py-2 text-xs font-semibold text-[#57745e]"><Upload size={15} />Choose picture<input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={uploadAvatar} /></label><button onClick={removeAvatar} className="rounded-lg px-3 py-2 text-xs text-[#78867d] hover:bg-[#f4f6f2]">Remove picture</button></div></section>
    <form onSubmit={changePassword} className="mb-6 rounded-2xl border border-[#e9ede5] bg-white p-5"><h2 className="text-sm font-semibold text-[#46594b]">Change password</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" className={field} /><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (8–72 characters)" className={field} /></div><button className="mt-3 rounded-lg bg-[#edf3ea] px-4 py-2 text-xs font-semibold text-[#45664e]">Update password</button></form>
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e9ede5] bg-white p-5"><div><h2 className="text-sm font-semibold text-[#46594b]">Your data</h2><p className="mt-1 text-xs text-[#8b968d]">Download your profile, records, and private document contents as JSON.</p></div><button onClick={exportData} className="flex items-center gap-2 rounded-lg border border-[#dbe5d9] px-3 py-2 text-xs font-semibold text-[#57745e]"><Download size={15} />Export my data</button></section>
    <form onSubmit={deleteAccount} className="rounded-2xl border border-[#f0dfdc] bg-white p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-[#9b4942]"><Trash2 size={16} />Delete account</h2><p className="mt-1 text-xs text-[#8b7876]">Your account, records, supporter links, profile picture, and uploaded files will be deleted.</p><div className="mt-3 flex flex-wrap gap-2"><input type="password" autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Confirm your password" className={`${field} max-w-sm`} /><button className="rounded-lg bg-[#a94841] px-3 py-2 text-xs font-semibold text-white">Delete permanently</button></div></form>
  </>;
}
