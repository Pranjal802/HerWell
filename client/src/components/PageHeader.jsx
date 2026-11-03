import { translate } from "../lib/translations.js";

export default function PageHeader({ eyebrow, title, description, action }) {
  return <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#829087]">{translate(eyebrow)}</p>}
      <h1 className="font-[Manrope] text-3xl font-semibold tracking-tight text-[#263d31]">{translate(title)}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#849087]">{translate(description)}</p>}
    </div>
    {action}
  </header>;
}
