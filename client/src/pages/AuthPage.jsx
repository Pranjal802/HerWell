import { useState } from "react";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
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

  const tabs = [["login", "Sign in"], ["register", "Create an account"]];
  const heading = mode === "forgot" ? "Forgot your password?"
    : mode === "reset" ? "Choose a new password"
      : mode === "register" ? "Create your private space"
        : "A calmer way to care for yourself.";

  return <main className="hw-auth-shell">
    <div className="hw-auth-orb hw-auth-orb-one" aria-hidden="true" />
    <div className="hw-auth-orb hw-auth-orb-two" aria-hidden="true" />
    <div className="hw-auth-layout">
      <section className="hw-auth-intro">
        <Brand />
        <div className="hw-auth-intro-copy">
          <span className="hw-auth-kicker"><Sparkles size={16} />{translate("YOUR SPACE, YOUR PACE")}</span>
          <h1>A calmer way to care for yourself.</h1>
          <p>Bring your routines, reminders and personal notes together in one private space.</p>
        </div>
        <div className="hw-auth-promise"><LockKeyhole size={18} /><span>Private by default. Always in your control.</span></div>
      </section>

      <section className="hw-auth-card" aria-labelledby="auth-title">
        <div className="hw-auth-mobile-brand"><Brand /></div>
        {notice && <p role="status" className="hw-auth-message is-success">{notice}</p>}
        <div className="hw-auth-heading">
          <span className="hw-auth-kicker"><Sparkles size={15} />{translate("A LITTLE SPACE FOR YOU")}</span>
          <h2 id="auth-title">{translate(heading)}</h2>
          <p>{translate("Your plans, reminders and reflections — all together, and just for you.")}</p>
        </div>

        {(mode === "login" || mode === "register") && <div className="hw-auth-tabs" role="tablist" aria-label="Account options">
          {tabs.map(([key, text]) => <button
            key={key}
            id={`auth-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => { setMode(key); setError(""); setMessage(""); }}
          >{translate(text)}</button>)}
        </div>}

        <form className="hw-auth-form" onSubmit={submit}>
          {mode === "register" && <label className="hw-auth-label">{translate("Your name")}
            <input className="hw-auth-input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} />
          </label>}
          {mode !== "reset" && <label className="hw-auth-label">{translate("Email address")}
            <input className="hw-auth-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>}
          {["login", "register", "reset"].includes(mode) && <label className="hw-auth-label">{translate(mode === "reset" ? "New password" : "Password")}
            <input className="hw-auth-input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} required />
          </label>}
          {message && <p role="status" className="hw-auth-message is-success">{message}</p>}
          {error && <p role="alert" className="hw-auth-message is-error">{error}</p>}
          <button disabled={busy} className="hw-auth-submit">
            {busy ? translate("One moment…") : translate(mode === "login" ? "Come on in" : mode === "register" ? "Create my space" : mode === "forgot" ? "Send reset link" : "Save new password")}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="hw-auth-links">
          {(mode === "login" || mode === "forgot") && <button onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setError(""); }}>{translate(mode === "forgot" ? "Back to sign in" : "Forgot your password?")}</button>}
          {mode === "login" && <button onClick={resendVerification}>{translate("Resend verification")}</button>}
        </div>
        <p className="hw-auth-private"><LockKeyhole size={15} />{translate("Your wellness space is private by default.")}</p>
      </section>
    </div>
  </main>;
}
