import { useEffect, useState } from "react";
import {
  Bell, BookOpen, CalendarDays, ChevronRight, FileText, HeartPulse, Home,
  ListChecks, LockKeyhole, LogOut, Menu, Plus, Settings, ShieldCheck,
  Sparkles, Utensils, Users, X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Brand from "./Brand.jsx";
import Notice from "./Notice.jsx";
import { localeFor, translate } from "../lib/translations.js";

const navigation = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/planner", label: "My Planner", icon: ListChecks },
  { to: "/meals", label: "Meal Planner", icon: "meal" },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/wellness", label: "Wellness", icon: HeartPulse },
  { to: "/healthcare", label: "Healthcare", icon: HeartPulse },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/journal", label: "My Journal", icon: BookOpen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/ai", label: "HerWell AI", icon: Sparkles },
];

const mobileNavigation = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/planner", label: "Plan", icon: ListChecks, matches: ["/planner", "/meals", "/reminders"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/wellness", label: "Care", icon: HeartPulse, matches: ["/wellness", "/healthcare", "/documents"] },
  { to: "/more", label: "More", icon: Menu, matches: ["/more", "/journal", "/supporters", "/settings", "/ai"] },
];

const sectionTabs = {
  plan: [
    { to: "/planner", label: "Routines", icon: ListChecks },
    { to: "/meals", label: "Meals", icon: "meal" },
    { to: "/reminders", label: "Reminders", icon: Bell },
  ],
  care: [
    { to: "/wellness", label: "Check-in", icon: HeartPulse },
    { to: "/healthcare", label: "Appointments", icon: CalendarDays },
    { to: "/documents", label: "Documents", icon: FileText },
  ],
};

const quickActions = [
  ["routine", "Add routine", ListChecks],
  ["meal", "Add meal", "meal"],
  ["reminder", "Add reminder", Bell],
  ["checkin", "Daily check-in", HeartPulse],
  ["appointment", "Add appointment", CalendarDays],
  ["journal", "Journal entry", BookOpen],
];

function Icon({ icon: IconComponent, size = 20 }) {
  const Icon = IconComponent === "meal" ? Utensils : IconComponent;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function QuickAddSheet({ onClose, onQuickAdd }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className="hw-sheet-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="hw-quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
      <div className="hw-sheet-handle" />
      <header className="hw-quick-header">
        <div><p className="hw-eyebrow">A LITTLE AT A TIME</p><h2 id="quick-add-title">What would you like to add?</h2></div>
        <button className="hw-icon-button" aria-label="Close quick add" onClick={onClose}><X size={21} /></button>
      </header>
      <div className="hw-quick-grid">
        {quickActions.map(([category, label, icon]) => <button key={category} className="hw-quick-action" onClick={() => onQuickAdd(category)}>
          <span className="hw-quick-icon"><Icon icon={icon} size={22} /></span><span>{translate(label)}</span>
        </button>)}
      </div>
      <Link to="/documents" className="hw-upload-action" onClick={onClose}><FileText size={20} />Upload a document<ChevronRight size={18} /></Link>
    </section>
  </div>;
}

export default function AppLayout({ user, onLogout, notice, onDismissNotice, onQuickAdd, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [avatarAvailable, setAvatarAvailable] = useState(true);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const active = navigation.find((item) => item.to === location.pathname);
  const section = mobileNavigation.find((item) => item.matches?.includes(location.pathname));
  const tabs = section?.label === "Plan" ? sectionTabs.plan : section?.label === "Care" ? sectionTabs.care : null;
  const formattedDate = new Intl.DateTimeFormat(localeFor(), { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  useEffect(() => {
    const refresh = () => { setAvatarAvailable(true); setAvatarRevision((value) => value + 1); };
    window.addEventListener("herwell:avatar-updated", refresh);
    return () => window.removeEventListener("herwell:avatar-updated", refresh);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setQuickAddOpen(false);
  }, [location.pathname]);

  return <div className="hw-app-shell">
    <aside className="hw-sidebar">
      <div className="hw-sidebar-brand"><Brand /></div>
      <p className="hw-eyebrow hw-sidebar-eyebrow">{translate("YOUR SPACE")}</p>
      <nav className="hw-desktop-nav" aria-label="Main navigation">
        {navigation.map(({ to, label, icon, end }) => <NavLink key={to} to={to} end={end} aria-label={translate(label)} title={translate(label)} className={({ isActive }) => `hw-nav-link${isActive ? " is-active" : ""}`}>
          <Icon icon={icon} /><span>{translate(label)}</span>
        </NavLink>)}
      </nav>
      <div className="hw-sidebar-secondary">
        <NavLink to="/supporters" className={({ isActive }) => `hw-nav-link${isActive ? " is-active" : ""}`}><Users size={20} /><span>{translate("Supporter access")}</span></NavLink>
        <NavLink to="/settings" className={({ isActive }) => `hw-nav-link${isActive ? " is-active" : ""}`}><Settings size={20} /><span>{translate("Settings")}</span></NavLink>
      </div>
      <div className="hw-privacy-card"><ShieldCheck size={18} /><div><strong>{translate("Your space is private")}</strong><span>{translate("You decide what, if anything, is shared.")}</span></div></div>
      <button onClick={onLogout} className="hw-account-button">
        {avatarAvailable && <img key={avatarRevision} src={`/api/documents/avatar?rev=${avatarRevision}`} alt="" onError={() => setAvatarAvailable(false)} />}
        {!avatarAvailable && <span className="hw-avatar-fallback">{user.name?.[0]?.toUpperCase() || "H"}</span>}
        <span className="hw-account-name">{user.name}</span><LogOut size={18} aria-hidden="true" />
      </button>
    </aside>

    <div className="hw-main-column">
      <header className="hw-topbar">
        <div className="hw-topbar-title">
          <button className="hw-icon-button hw-mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <span className="hw-mobile-brand"><Brand /></span>
          <div className="hw-desktop-crumb"><Link to="/">{translate("Your space")}</Link><ChevronRight size={15} /><span>{translate(active?.label || "HerWell")}</span></div>
        </div>
        <div className="hw-topbar-actions">
          <span className="hw-topbar-date">{formattedDate}</span>
          <Link to="/ai" className="hw-icon-button hw-topbar-ai-btn" aria-label="HerWell AI" title="HerWell AI Assistant"><Sparkles size={20} /></Link>
          <Link to="/reminders" className="hw-icon-button" aria-label="View reminders"><Bell size={20} /></Link>
          <button className="hw-profile-button" onClick={() => navigate("/settings")} aria-label="Open profile and settings">
            {avatarAvailable && <img key={avatarRevision} src={`/api/documents/avatar?rev=${avatarRevision}`} alt="" onError={() => setAvatarAvailable(false)} />}
            {!avatarAvailable && <span className="hw-avatar-fallback">{user.name?.[0]?.toUpperCase() || "H"}</span>}
          </button>
        </div>
      </header>
      {tabs && <nav className="hw-section-tabs" aria-label={`${section.label} sections`}>
        {tabs.map(({ to, label, icon }) => <NavLink key={to} to={to} className={({ isActive }) => `hw-section-tab${isActive ? " is-active" : ""}`}>
          <Icon icon={icon} size={18} /><span>{translate(label)}</span>
        </NavLink>)}
      </nav>}
      <main className="hw-main-content">
        <Notice onDismiss={onDismissNotice}>{notice}</Notice>
        {children}
        <footer className="hw-footer"><span>{translate("Made for your wellbeing, never your worry.")}</span><span>{translate("HerWell is an organiser, not a medical adviser.")}</span></footer>
      </main>
    </div>

    {menuOpen && <div className="hw-mobile-drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
      <nav className="hw-mobile-drawer" aria-label="More navigation">
        <header><Brand /><button className="hw-icon-button" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={21} /></button></header>
        {[...navigation.slice(4, 8), { to: "/supporters", label: "Supporter access", icon: Users }, { to: "/settings", label: "Settings", icon: Settings }].map(({ to, label, icon }) =>
          <Link className="hw-drawer-link" to={to} key={to}><Icon icon={icon} /><span>{translate(label)}</span><ChevronRight size={18} /></Link>)}
        <button className="hw-drawer-link hw-drawer-logout" onClick={onLogout}><LogOut size={20} /><span>Sign out</span></button>
      </nav>
    </div>}

    <nav className="hw-bottom-nav" aria-label="Primary navigation">
      {mobileNavigation.map(({ to, label, icon, end, matches }) => {
        const selected = to === location.pathname || matches?.includes(location.pathname);
        return <NavLink key={to} to={to} end={end} aria-current={selected ? "page" : undefined} className={`hw-bottom-tab${selected ? " is-active" : ""}`}>
          <span className="hw-bottom-icon"><Icon icon={icon} /></span><span>{translate(label)}</span>
        </NavLink>;
      })}
    </nav>

    {location.pathname !== "/ai" && <Link to="/ai" className="hw-ai-floating-fab" aria-label="Open HerWell AI" title="Chat with HerWell AI"><Sparkles size={22} strokeWidth={2} /></Link>}
    <button className="hw-fab" onClick={() => setQuickAddOpen(true)} aria-label="Quick add"><Plus size={27} strokeWidth={2} /></button>
    {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} onQuickAdd={(category) => { setQuickAddOpen(false); onQuickAdd(category); }} />}
  </div>;
}
