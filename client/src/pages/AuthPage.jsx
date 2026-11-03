import { useState } from "react";
import { ArrowRight, Flower2, LockKeyhole, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Brand from "../components/Brand.jsx";
import { translate } from "../lib/translations.js";

export default function AuthPage({ onLogin, notice }) {
  const [params] = useSearchParams();
  const resetToken = params.get("resetPassword") || "";
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login" || mode === "register") {
        const result = await api(`/auth/${mode}`, { method: "POST", body: { name, email, password } });
        if (result.user) onLogin(result.user);
        else { setMessage(result.message); setMode("login"); }
      } else if (mode === "forgot") {
        const result = await api("/auth/forgot-password", { method: "POST", body: { email } });
        setMessage(result.message);
      } else {
        const result = await api("/auth/reset-password", { method: "POST", body: { token: resetToken, password } });
        setMessage(result.message); setMode("login"); window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  }

  async function resendVerification() {
    setError(""); setMessage("");
    try { setMessage((await api("/auth/resend-verification", { method: "POST", body: { email } })).message); }
    catch (sendError) { setError(sendError.message); }
  }

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_18%_72%,#eef2e8_0%,transparent_34%),radial-gradient(ellipse_at_91%_11%,#f1eddf_0%,transparent_29%),#f7f8f4] p-5">
    <div className="pointer-events-none absolute right-[15%] top-[15%] grid size-56 place-items-center rounded-full bg-[#edf2e8] text-[#9eaf93] opacity-60 max-md:right-[-100px]"><div className="absolute inset-[-20px] rounded-full border border-[#d8e1d3]" /><Flower2 size={54} strokeWidth={1} /></div>
    <section className="relative w-full max-w-md rounded-2xl border border-[#ebeee8] bg-white/95 p-8 shadow-xl shadow-[#4856400c] max-sm:p-6">
      <Brand />
      {notice && <p role="status" className="mb-4 rounded-lg bg-[#edf5eb] p-3 text-xs leading-5 text-[#45664e]">{notice}</p>}
      <div className="mb-6 mt-8"><p className="flex items-center gap-2 text-[10px] font-bold tracking-[.14em] text-[#829087]"><Sparkles size={14} /> {translate("A LITTLE SPACE FOR YOU")}</p><h1 className="mt-3 font-[Manrope] text-3xl font-semibold leading-tight tracking-tight text-[#2e4637]">{translate("Take care, at your own pace.")}</h1><p className="mt-2 text-sm leading-6 text-[#849087]">{translate("Your plans, reminders and reflections — all together, and just for you.")}</p></div>
      {(mode === "login" || mode === "register") && <div className="mb-4 grid grid-cols-2 border-b border-[#e9ece5]">{[["login", "Sign in"], ["register", "Create an account"]].map(([key, text]) => <button key={key} type="button" onClick={() => { setMode(key); setError(""); setMessage(""); }} className={`border-b-2 py-2.5 text-xs ${mode === key ? "border-[#6d8b70] font-semibold text-[#46654d]" : "border-transparent text-[#939d95]"}`}>{translate(text)}</button>)}</div>}
      <form className="space-y-4" onSubmit={submit}>
        {mode === "register" && <label className="block text-xs font-semibold text-[#516257]">{translate("Your name")}<input className="mt-1 w-full rounded-lg border border-[#e2e8df] bg-[#fbfcfa] px-3 py-2.5 text-sm outline-none focus:border-[#9db59e]" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /></label>}
        {mode !== "reset" && <label className="block text-xs font-semibold text-[#516257]">{translate("Email address")}<input className="mt-1 w-full rounded-lg border border-[#e2e8df] bg-[#fbfcfa] px-3 py-2.5 text-sm outline-none focus:border-[#9db59e]" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        {["login", "register", "reset"].includes(mode) && <label className="block text-xs font-semibold text-[#516257]">{translate(mode === "reset" ? "New password" : "Password")}<input className="mt-1 w-full rounded-lg border border-[#e2e8df] bg-[#fbfcfa] px-3 py-2.5 text-sm outline-none focus:border-[#9db59e]" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} required /></label>}
        {message && <p role="status" className="rounded-lg bg-[#edf5eb] p-3 text-xs leading-5 text-[#45664e]">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-[#fbefed] p-3 text-xs text-[#a94841]">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-3 text-sm font-semibold text-white hover:bg-[#264b39] disabled:opacity-60">{busy ? translate("One moment…") : translate(mode === "login" ? "Come on in" : mode === "register" ? "Create my space" : mode === "forgot" ? "Send reset link" : "Save new password")}<ArrowRight size={17} /></button>
      </form>
      <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs">
        {(mode === "login" || mode === "forgot") && <button className="text-[#62816a] hover:underline" onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setError(""); }}>{translate(mode === "forgot" ? "Back to sign in" : "Forgot your password?")}</button>}
        {mode === "login" && <button className="text-[#62816a] hover:underline" onClick={resendVerification}>{translate("Resend verification")}</button>}
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#929d94]"><LockKeyhole size={13} />{translate("Your wellness space is private by default.")}</p>
    </section>
  </main>;
}
