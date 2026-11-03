import { useEffect, useState } from "react";
import { Bell, BookHeart, CalendarDays, ChevronRight, Droplets, Heart, LockKeyhole, LogOut, Menu, Salad, ShieldCheck, Sparkles, Sunrise, Sun, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Brand from "./Brand.jsx";
import Notice from "./Notice.jsx";
import { localeFor, translate } from "../lib/translations.js";

const navigation = [
  { to: "/", label: "Dashboard", icon: Sun, end: true },
  { to: "/planner", label: "My Planner", icon: Sunrise },
  { to: "/meals", label: "Meal Planner", icon: Salad },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/wellness", label: "Wellness", icon: Sparkles },
  { to: "/healthcare", label: "Healthcare", icon: Heart },
  { to: "/documents", label: "Documents", icon: LockKeyhole },
  { to: "/journal", label: "My Journal", icon: BookHeart },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
];

export default function AppLayout({ user, onLogout, notice, onDismissNotice, children }) {
  const [open, setOpen] = useState(false);
  const [avatarAvailable, setAvatarAvailable] = useState(true);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const location = useLocation();
  const active = navigation.find((item) => item.to === location.pathname);
  useEffect(() => {
    const refresh = () => { setAvatarAvailable(true); setAvatarRevision((value) => value + 1); };
    window.addEventListener("herwell:avatar-updated", refresh);
    return () => window.removeEventListener("herwell:avatar-updated", refresh);
  }, []);
  const formattedDate = new Intl.DateTimeFormat(localeFor(), { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  return <div className="min-h-screen bg-[#f7f8f4] text-[#23382f]">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-[#e9ece5] bg-white px-5 py-6 transition-transform max-md:-translate-x-full ${open ? "max-md:translate-x-0" : ""}`}>
      <div className="flex items-center justify-between"><Brand /><button className="hidden rounded-lg p-2 text-[#76857a] hover:bg-[#f0f3ed] max-md:block" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <p className="mb-3 mt-10 px-2 text-[10px] font-bold tracking-[.14em] text-[#8a968e]">{translate("YOUR SPACE")}</p>
      <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${isActive ? "bg-[#edf3ea] font-semibold text-[#234636]" : "text-[#78867d] hover:bg-[#f6f8f4] hover:text-[#2f5b48]"}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{translate(label)}</span>{active?.to === to && <ChevronRight className="ml-auto" size={15} />}
        </NavLink>)}
      </nav>
      <div className="mt-4 space-y-2 border-t border-[#e9ece5] pt-3">
        <NavLink to="/supporters" onClick={() => setOpen(false)} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? "bg-[#edf3ea] font-semibold text-[#234636]" : "text-[#78867d] hover:bg-[#f6f8f4]"}`}><Heart size={17} />{translate("Supporter access")}</NavLink>
        <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? "bg-[#edf3ea] font-semibold text-[#234636]" : "text-[#78867d] hover:bg-[#f6f8f4]"}`}><LockKeyhole size={17} />{translate("Settings")}</NavLink>
      </div>
      <div className="mt-4 rounded-xl bg-[#f6f8f4] p-3"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={16} className="text-[#4c7555]" />{translate("Your space is private")}</div><p className="mt-1 text-[11px] text-[#7e8a82]">{translate("You decide what, if anything, is shared.")}</p></div>
      <button onClick={onLogout} className="mt-4 flex items-center gap-3 border-t border-[#e9ece5] pt-4 text-left text-sm text-[#65756a] hover:text-[#2f5b48]">{avatarAvailable && <img key={avatarRevision} src={`/api/documents/avatar?rev=${avatarRevision}`} alt="" className="size-9 rounded-full object-cover" onError={() => setAvatarAvailable(false)} />} {!avatarAvailable && <span className="grid size-9 place-items-center rounded-full bg-[#ecdfd1] font-semibold text-[#785d4a]">{user.name?.[0]?.toUpperCase() || "H"}</span>}<span className="min-w-0 flex-1 truncate font-medium">{user.name}</span><LogOut size={16} /></button>
    </aside>
    {open && <button aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-20 hidden bg-[#1c302870] max-md:block" />}
    <main className="min-h-screen md:ml-[260px]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e9ece5] bg-[#ffffffeb] px-8 backdrop-blur max-md:px-4">
        <div className="flex items-center gap-3"><button className="hidden rounded-lg p-2 text-[#76857a] hover:bg-[#f0f3ed] max-md:block" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="text-xs text-[#9aa39c]"><Link to="/" className="hover:text-[#47634d]">{translate("Your space")}</Link><ChevronRight className="mx-1 inline" size={13} /><span className="text-[#52665a]">{translate(active?.label || "HerWell")}</span></div></div>
        <div className="flex items-center gap-2 text-xs text-[#77847a]"><CalendarDays size={15} /><span className="max-sm:hidden">{formattedDate}</span><Link to="/reminders" aria-label="View reminders" className="ml-3 rounded-lg border border-[#e9ece5] p-2 hover:bg-[#f4f6f2]"><Bell size={16} /></Link><Link to="/wellness" aria-label="Hydration tracker" className="rounded-lg border border-[#e9ece5] p-2 hover:bg-[#f4f6f2]"><Droplets size={16} /></Link></div>
      </header>
      <div className="mx-auto max-w-6xl px-8 py-8 max-md:px-4 max-md:py-6"><Notice onDismiss={onDismissNotice}>{notice}</Notice>{children}<footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-[#e9ece5] pt-4 text-[11px] text-[#919b92]"><span>{translate("Made for your wellbeing, never your worry.")}</span><span>{translate("HerWell is an organiser, not a medical adviser.")}</span></footer></div>
    </main>
  </div>;
}
