import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { Flower2 } from "lucide-react";
import { api } from "./lib/api.js";
import AppLayout from "./components/AppLayout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RecordsPage from "./pages/RecordsPage.jsx";
import RemindersPage from "./pages/RemindersPage.jsx";
import WellnessPage from "./pages/WellnessPage.jsx";
import JournalPage from "./pages/JournalPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import SupportersPage from "./pages/SupportersPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { localDateKey, occurrenceStatus } from "./lib/recurrence.js";
import "./styles.css";

function Workspace({ user, setUser, notice, setNotice }) {
  const [records, setRecords] = useState([]);
  const [supporters, setSupporters] = useState([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const refreshRecords = useCallback(async () => {
    const data = await api("/records");
    setRecords(data.records);
  }, []);

  useEffect(() => {
    refreshRecords().catch((error) => setNotice(error.message));
  }, [refreshRecords, setNotice]);
  useEffect(() => {
    const refresh = () => refreshRecords().catch((error) => setNotice(error.message));
    window.addEventListener("herwell:meal-image-updated", refresh);
    return () => window.removeEventListener("herwell:meal-image-updated", refresh);
  }, [refreshRecords, setNotice]);
  useEffect(() => {
    api("/supporters").then(({ supporters: active }) => setSupporters(active.filter((supporter) => supporter.status === "accepted"))).catch((error) => setNotice(error.message));
  }, [setNotice]);

  useEffect(() => {
    const token = searchParams.get("acceptInvite");
    if (!token) return;
    api("/supporters/invitations/accept", { method: "POST", body: { token } })
      .then(({ message }) => { setNotice(message); navigate("/supporters", { replace: true }); })
      .catch((error) => { setNotice(error.message); navigate("/supporters", { replace: true }); });
  }, [searchParams, navigate, setNotice]);

  async function saveRecord(values, id) {
    const { record } = await api(id ? `/records/${id}` : "/records", {
      method: id ? "PATCH" : "POST",
      body: values,
    });
    await refreshRecords();
    setNotice(id ? "Your changes are saved." : "Saved to your private space.");
    return record;
  }

  async function deleteRecord(record) {
    await api(`/records/${record._id}`, { method: "DELETE" });
    setRecords((items) => items.filter((item) => item._id !== record._id));
    setNotice("Removed from your space.");
  }

  async function toggleRecord(record) {
    if (record.recurrence?.frequency && record.recurrence.frequency !== "none") {
      const status = occurrenceStatus(record) === "completed" ? "planned" : "completed";
      await updateOccurrence(record, localDateKey(new Date()), status);
      return;
    }
    const { record: updated } = await api(`/records/${record._id}`, {
      method: "PATCH",
      body: { completed: !record.completed },
    });
    setRecords((items) => items.map((item) => item._id === updated._id ? updated : item));
  }

  async function skipRecord(record) {
    if (record.recurrence?.frequency && record.recurrence.frequency !== "none") {
      await updateOccurrence(record, localDateKey(new Date()), "skipped");
      return;
    }
    const { record: updated } = await api(`/records/${record._id}`, { method: "PATCH", body: { status: "skipped" } });
    setRecords((items) => items.map((item) => item._id === updated._id ? updated : item));
  }

  async function updateOccurrence(record, dateKey, status) {
    const { record: updated } = await api(`/records/${record._id}/occurrences`, { method: "PATCH", body: { dateKey, status } });
    setRecords((items) => items.map((item) => item._id === updated._id ? updated : item));
  }

  async function shareRecord(record, supporterId) {
    const share = !(record.sharedWith || []).includes(supporterId);
    await api(`/supporters/records/${record._id}/share`, {
      method: "POST",
      body: { supporterId, share },
    });
    await refreshRecords();
    setNotice(share ? "Shared with your supporter." : "Sharing stopped.");
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    navigate("/");
  }

  return (
    <AppLayout user={user} onLogout={logout} notice={notice} onDismissNotice={() => setNotice("")}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} records={records} onSave={saveRecord} onToggle={toggleRecord} onSkip={skipRecord} onDelete={deleteRecord} onShare={shareRecord} supporters={supporters} />} />
        <Route path="/planner" element={<RecordsPage title="My planner" description="Routines and small plans, at your own pace." category="routine" records={records} onSave={saveRecord} onToggle={toggleRecord} onSkip={skipRecord} onDelete={deleteRecord} onShare={shareRecord} supporters={supporters} />} />
        <Route path="/meals" element={<RecordsPage title="Meal planner" description="Organise meals, ingredients, and clinician-provided guidance." category="meal" records={records} onSave={saveRecord} onToggle={toggleRecord} onDelete={deleteRecord} onShare={shareRecord} supporters={supporters} />} />
        <Route path="/reminders" element={<RemindersPage records={records} onSave={saveRecord} onToggle={toggleRecord} onDelete={deleteRecord} profile={user.profile} />} />
        <Route path="/wellness" element={<WellnessPage records={records} onSave={saveRecord} onDelete={deleteRecord} />} />
        <Route path="/healthcare" element={<RecordsPage title="Healthcare" description="Appointments, clinician-provided instructions, and follow-ups." category={["appointment", "followup"]} records={records} onSave={saveRecord} onToggle={toggleRecord} onDelete={deleteRecord} onShare={shareRecord} supporters={supporters} />} />
        <Route path="/journal" element={<JournalPage records={records} onSave={saveRecord} onDelete={deleteRecord} onShare={shareRecord} supporters={supporters} />} />
        <Route path="/calendar" element={<CalendarPage records={records} onOccurrence={updateOccurrence} />} />
        <Route path="/documents" element={<DocumentsPage setNotice={setNotice} />} />
        <Route path="/supporters" element={<SupportersPage records={records} onShare={shareRecord} setNotice={setNotice} />} />
        <Route path="/settings" element={<SettingsPage user={user} setUser={setUser} setNotice={setNotice} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

function Root() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  function setAuthenticatedUser(nextUser) {
    document.documentElement.lang = nextUser?.profile?.language === "es" ? "es" : "en";
    setUser(nextUser);
  }

  useEffect(() => {
    const preference = user?.profile?.theme || "system";
    const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = user?.profile?.language === "es" ? "es" : "en";
  }, [user]);

  useEffect(() => {
    const verificationToken = searchParams.get("verifyEmail");
    const emailChangeToken = searchParams.get("changeEmail");
    const verify = emailChangeToken
      ? api("/auth/change-email/confirm", { method: "POST", body: { token: emailChangeToken } })
        .then(({ message }) => { setNotice(message); setUser(null); })
      : verificationToken
        ? api("/auth/verify-email", { method: "POST", body: { token: verificationToken } })
          .then(({ user: verifiedUser }) => {
            setAuthenticatedUser(verifiedUser);
            setNotice("Your email is verified. Welcome to HerWell.");
          })
        : api("/auth/me").then(({ user: current }) => setAuthenticatedUser(current));
    verify.catch((error) => { setUser(null); if (emailChangeToken) setNotice(error.message); }).finally(() => {
      if (verificationToken || emailChangeToken) navigate("/", { replace: true });
      setLoading(false);
    });
  }, [navigate, searchParams, setNotice]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f7f8f4] text-[#52715b]"><div className="flex items-center gap-3"><Flower2 className="animate-pulse" /><span className="text-sm">Making a little space…</span></div></div>;

  return user
    ? <Workspace user={user} setUser={setAuthenticatedUser} notice={notice} setNotice={setNotice} />
    : <AuthPage onLogin={setAuthenticatedUser} notice={notice} />;
}

export default function App() {
  return <BrowserRouter><Root /></BrowserRouter>;
}
