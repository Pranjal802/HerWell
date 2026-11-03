import { CheckCircle2, X } from "lucide-react";

export default function Notice({ children, onDismiss }) {
  if (!children) return null;
  return <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#dfe8dc] bg-white px-4 py-3 text-sm text-[#47634d] shadow-sm">
    <span className="flex items-center gap-2"><CheckCircle2 size={17} />{children}</span>
    {onDismiss && <button className="rounded p-1 text-[#8a988d] hover:bg-[#f4f6f2]" onClick={onDismiss} aria-label="Dismiss message"><X size={15} /></button>}
  </div>;
}
