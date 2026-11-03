import { BookOpen, ChevronRight, FileText, HeartHandshake, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import { translate } from "../lib/translations.js";

const links = [
  { to: "/journal", title: "My Journal", detail: "A private place for thoughts and reflections.", icon: BookOpen },
  { to: "/documents", title: "Documents", detail: "Your private health documents.", icon: FileText },
  { to: "/supporters", title: "Supporter access", detail: "Choose what you share with someone you trust.", icon: Users },
  { to: "/settings", title: "Settings", detail: "Profile, preferences, and account privacy.", icon: LockKeyhole },
];

export default function MorePage() {
  return <div className="hw-more-page">
    <PageHeader eyebrow="YOUR SPACE" title="More" description="Your personal tools and privacy, all in one place." />
    <section className="hw-more-privacy"><ShieldCheck size={23} /><div><h2>Your space is private</h2><p>You decide what, if anything, is shared. You can change your choices at any time.</p></div></section>
    <nav className="hw-more-links" aria-label="More pages">
      {links.map(({ to, title, detail, icon: Icon }) => <Link className="hw-more-link" to={to} key={to}>
        <span className="hw-more-link-icon"><Icon size={22} strokeWidth={1.8} /></span>
        <span className="hw-more-link-copy"><strong>{translate(title)}</strong><small>{translate(detail)}</small></span>
        <ChevronRight className="hw-more-chevron" size={20} />
      </Link>)}
    </nav>
    <p className="hw-more-emergency"><HeartHandshake size={18} />HerWell is an organiser, not a medical adviser or emergency service.</p>
  </div>;
}
