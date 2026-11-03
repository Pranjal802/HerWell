import { useEffect, useRef, useState } from "react";
import { Bell, Clock3, Plus, VolumeX } from "lucide-react";
import { api } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";
import RecordForm from "../components/RecordForm.jsx";
import RecordList from "../components/RecordList.jsx";

export default function RemindersPage({ records, onSave, onToggle, onDelete, profile }) {
  const [form, setForm] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [pushConfig, setPushConfig] = useState(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const shown = useRef(new Set());

  async function loadNotifications() {
    const data = await api("/notifications");
    setNotifications(data.notifications);
  }
  useEffect(() => { loadNotifications().catch((loadError) => setError(loadError.message)); }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      api("/notifications/push/config"),
      "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration("/") : Promise.resolve(null),
    ]).then(async ([config, registration]) => {
      if (!active) return;
      setPushConfig(config);
      if (config.enabled && registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api("/notifications/push/subscriptions", { method: "POST", body: { subscription: subscription.toJSON() } });
          if (active) setPushSubscribed(true);
        }
      }
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, []);

  async function togglePush() {
    setPushBusy(true); setError("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (existing && pushSubscribed) {
        await api("/notifications/push/subscriptions", { method: "DELETE", body: { endpoint: existing.endpoint } });
        await existing.unsubscribe();
        setPushSubscribed(false);
        setError("Background notifications are turned off on this device.");
        return;
      }
      if (!pushConfig?.enabled || !pushConfig.publicKey) throw new Error("Background notifications are not configured on this server yet.");
      if (!("Notification" in window)) throw new Error("This browser does not support device notifications.");
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(pushConfig.publicKey),
      });
      await api("/notifications/push/subscriptions", { method: "POST", body: { subscription: subscription.toJSON() } });
      setPushSubscribed(true);
      setError("Background reminders are enabled on this device.");
    } catch (subscriptionError) { setError(subscriptionError.message); }
    finally { setPushBusy(false); }
  }

  async function act(notification, action) {
    try {
      await api(`/notifications/${notification._id}/action`, { method: "POST", body: { action, minutes: 15 } });
      await loadNotifications();
    } catch (actionError) { setError(actionError.message); }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) { setError("This browser does not support device notifications."); return; }
    const permission = await window.Notification.requestPermission();
    setError(permission === "granted" ? "Device notifications are enabled while HerWell is open." : "Notification permission was not granted.");
  }

  useEffect(() => {
    if (pushSubscribed || profile?.notificationsEnabled === false || !("Notification" in window) || Notification.permission !== "granted") return undefined;
    const check = () => notifications.forEach((item) => {
      if (item.status === "pending" && new Date(item.scheduledAt) <= new Date() && !shown.current.has(item._id) && !isQuietTime(profile)) {
        try {
          const reminder = new Notification("HerWell reminder", { body: "A reminder is ready in your private space." });
          reminder.onclick = () => { window.focus(); window.location.assign("/reminders"); };
        }
        catch (notificationError) { setError(notificationError.message); return; }
        shown.current.add(item._id);
        api(`/notifications/${item._id}/action`, { method: "POST", body: { action: "delivered" } })
          .then(loadNotifications).catch((deliveryError) => setError(deliveryError.message));
      }
    });
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [notifications, profile]);

  const reminders = records.filter((record) => record.category === "reminder" || record.reminderAt);
  return <>
    <PageHeader title="Reminders" description="A gentle nudge for the things you choose to remember." action={<button onClick={() => setForm({ category: "reminder" })} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />Add reminder</button>} />
    <button disabled={pushBusy} onClick={pushConfig?.enabled ? togglePush : enableNotifications} className="mb-5 flex items-center gap-2 rounded-xl border border-[#e5ebe2] bg-white px-4 py-3 text-xs font-semibold text-[#57745e] hover:bg-[#f5f8f3] disabled:opacity-60"><Bell size={16} />{pushBusy ? "Updating notifications…" : pushSubscribed ? "Turn off background notifications" : pushConfig?.enabled ? "Enable background notifications" : "Enable while app is open"}</button>
    <p className="mb-6 flex items-start gap-2 text-xs leading-5 text-[#89958b]"><VolumeX size={15} className="mt-0.5 shrink-0" />{pushSubscribed ? "Scheduled reminders can arrive while HerWell is closed on this device. Delivery still depends on browser and operating-system support." : "While HerWell is open, reminders can appear if permission is granted. Configure VAPID keys on the server to enable background push."} Quiet hours are respected.</p>
    {error && <p role="status" className="mb-4 text-xs text-[#8b6a36]">{error}</p>}
    <section className="mb-8"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#46594b]"><Clock3 size={16} />Your reminder schedule</h2><RecordList records={reminders} onSave={(item) => setForm(item)} onToggle={onToggle} onDelete={onDelete} emptyTitle="No reminders yet." emptyText="Create a reminder when something would be helpful to remember." emptyAction={() => setForm({ category: "reminder" })} /></section>
    <section><h2 className="mb-3 text-sm font-semibold text-[#46594b]">Notification history</h2><div className="rounded-2xl border border-[#e9ede5] bg-white px-4">{notifications.length ? notifications.map((item) => <article key={item._id} className="flex flex-wrap items-center gap-3 border-b border-[#edf0e9] py-3 last:border-0"><span className="min-w-0 flex-1 text-xs text-[#52665a]">{item.title}<small className="mt-1 block text-[10px] capitalize text-[#8b968d]">{item.status} · {new Date(item.scheduledAt).toLocaleString()}</small></span>{["pending", "snoozed", "sent"].includes(item.status) && <><button onClick={() => act(item, "snooze")} className="rounded-lg border border-[#e2e8df] px-3 py-2 text-[10px] text-[#57745e]">Snooze 15 min</button><button onClick={() => act(item, "dismiss")} className="rounded-lg bg-[#f2f4ef] px-3 py-2 text-[10px] text-[#65756a]">Dismiss</button></>}</article>) : <p className="p-5 text-xs text-[#8b968d]">Your notification history is empty.</p>}</div></section>
    {form && <RecordForm initial={form} records={records} onClose={() => setForm(null)} onSave={onSave} />}
  </>;
}

function isQuietTime(profile) {
  const { quietHoursStart: start, quietHoursEnd: end, timeZone = "UTC" } = profile || {};
  if (!start || !end || start === end) return false;
  const current = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date());
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function decodeApplicationServerKey(value) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
