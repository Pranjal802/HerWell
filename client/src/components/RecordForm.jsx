import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { api, localDateTime, toIso } from "../lib/api.js";
import { translate } from "../lib/translations.js";

const categories = [
  ["routine", "Routine"], ["meal", "Meal"], ["reminder", "Reminder"], ["followup", "Follow-up task"],
  ["appointment", "Appointment"], ["journal", "Journal entry"], ["activity", "Movement"], ["water", "Water"],
  ["checkin", "Wellness check-in"],
];
const checkIns = [
  ["mood", "Mood", [["low", "A little low"], ["okay", "Okay"], ["good", "Good"]]],
  ["energy", "Energy", [["low", "Low"], ["okay", "Steady"], ["good", "Good"]]],
  ["sleep", "Sleep", [["restless", "Restless"], ["okay", "Okay"], ["restful", "Restful"]]],
  ["appetite", "Appetite", [["less", "Less than usual"], ["usual", "About usual"], ["more", "More than usual"]]],
  ["digestion", "Digestion", [["noticeable", "Noticed a change"], ["okay", "Okay"], ["comfortable", "Comfortable"]]],
];
const blank = { category: "routine", title: "", notes: "", scheduledAt: "", startsAt: "", endsAt: "", startDate: "", endDate: "", categoryLabel: "", repeatFrequency: "none", repeatInterval: 1, repeatDays: [], mealType: "breakfast", ingredients: "", preparation: "", vegetarian: false, reminderAt: "", reminderEnabled: false, amountMl: 250, durationMinutes: "", activityType: "", checkIn: {}, appointment: {}, journal: {}, measurement: { type: "", value: "", unit: "" } };
const input = "mt-1 w-full rounded-lg border border-[#e2e8df] bg-white px-3 py-2.5 text-sm text-[#33473a] outline-none focus:border-[#9db59e] focus:ring-2 focus:ring-[#eaf1e8]";
const label = "block text-xs font-semibold text-[#516257]";

function fromRecord(record) {
  const recurrence = record.recurrence || {};
  return {
    ...blank,
    ...record,
    scheduledAt: localDateTime(record.scheduledAt),
    reminderAt: localDateTime(record.reminderAt),
    startsAt: localDateTime(record.startsAt),
    endsAt: localDateTime(record.endsAt),
    startDate: record.startDate?.slice(0, 10) || recurrence.startDateKey || "",
    endDate: record.endDate?.slice(0, 10) || recurrence.endDateKey || "",
    repeatFrequency: recurrence.frequency || "none",
    repeatInterval: recurrence.interval || 1,
    repeatDays: recurrence.daysOfWeek || [],
  };
}

export default function RecordForm({ initial, records = [], onClose, onSave }) {
  const [form, setForm] = useState(() => initial?._id ? fromRecord(initial) : { ...blank, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mealImage, setMealImage] = useState(null);
  const [removeMealImage, setRemoveMealImage] = useState(false);
  const [mealImagePreview, setMealImagePreview] = useState("");
  useEffect(() => {
    if (!mealImage) { setMealImagePreview(""); return undefined; }
    const url = URL.createObjectURL(mealImage);
    setMealImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [mealImage]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeNested = (key, field, value) => setForm((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  const noTitle = form.category === "checkin" || form.category === "water";

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = {
      ...form,
      title: form.category === "checkin" ? "Daily wellness check-in" : form.category === "water" ? `${form.amountMl} ml water` : form.title,
      scheduledAt: toIso(form.scheduledAt),
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt),
      startDate: toIso(form.startDate),
      endDate: toIso(form.endDate),
      reminderAt: form.category === "reminder" ? toIso(form.scheduledAt) : toIso(form.reminderAt),
      reminderEnabled: form.category === "reminder" ? Boolean(form.scheduledAt) : form.reminderEnabled,
      recurrence: {
        frequency: form.repeatFrequency,
        interval: Number(form.repeatInterval) || 1,
        ...(form.repeatDays.length ? { daysOfWeek: form.repeatDays } : {}),
        ...(form.startDate || form.scheduledAt || form.startsAt ? { startDateKey: form.startDate || form.scheduledAt.slice(0, 10) || form.startsAt.slice(0, 10) } : {}),
        ...(form.endDate ? { endDateKey: form.endDate } : {}),
      },
    };
    delete values.repeatFrequency;
    delete values.repeatInterval;
    if (form.durationMinutes === "") delete values.durationMinutes;
    else values.durationMinutes = Number(form.durationMinutes);
    if (!form.linkRecordId) delete values.linkRecordId;
    if (form.category === "checkin") values.checkIn = Object.fromEntries(Object.entries(form.checkIn || {}).filter(([, value]) => value));
    if (form.measurement?.type && form.measurement?.unit && form.measurement?.value !== "") values.measurement = { ...form.measurement, value: Number(form.measurement.value) };
    else delete values.measurement;
    if (form.category === "water") values.amountMl = Number(form.amountMl);
    if (form.category === "journal") {
      const journal = { ...form.journal };
      if (!journal.mood) delete journal.mood;
      values.journal = journal;
    }
    try {
      const saved = await onSave(values, form._id);
      setForm(fromRecord(saved));
      if (form.category === "meal" && mealImage) {
        const body = new FormData(); body.append("file", mealImage);
        await api(`/documents/meals/${saved._id}/image`, { method: "POST", body });
        window.dispatchEvent(new Event("herwell:meal-image-updated"));
      } else if (form.category === "meal" && removeMealImage && form.mealImageFileId) {
        await api(`/documents/meals/${saved._id}/image`, { method: "DELETE" });
        window.dispatchEvent(new Event("herwell:meal-image-updated"));
      }
      onClose();
    }
    catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#24352e63] p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="record-form-title" className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <header className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#829087]">{translate("A LITTLE SPACE FOR YOU")}</p><h2 id="record-form-title" className="mt-1 font-[Manrope] text-xl font-semibold text-[#304538]">{form._id ? translate("Edit your space") : `${translate("Add")} ${translate(categories.find(([key]) => key === form.category)?.[1] || "item").toLowerCase()}`}</h2></div><button className="rounded-lg p-2 text-[#76857a] hover:bg-[#f0f3ed]" onClick={onClose} aria-label={translate("Close")}><X size={19} /></button></header>
      <form className="space-y-4" onSubmit={submit}>
        <label className={label}>{translate("Type")}<select className={input} disabled={Boolean(form._id)} value={form.category} onChange={(event) => change("category", event.target.value)}>{categories.map(([key, name]) => <option key={key} value={key}>{translate(name)}</option>)}</select></label>
        {!noTitle && <label className={label}>{translate(form.category === "meal" ? "Meal name" : form.category === "journal" ? "Entry title" : form.category === "routine" ? "Routine name" : "Name")}<input className={input} autoFocus maxLength={120} required value={form.title} onChange={(event) => change("title", event.target.value)} placeholder={translate("What would you like to remember?")} /></label>}
        {form.category === "routine" && <>
          <label className={label}>{translate("Category")}<input className={input} maxLength={60} value={form.categoryLabel} onChange={(event) => change("categoryLabel", event.target.value)} placeholder={translate("Morning, personal care, evening…")} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className={label}>{translate("Start time")}<input className={input} type="datetime-local" value={form.startsAt} onChange={(event) => change("startsAt", event.target.value)} /></label><label className={label}>{translate("End time")}<input className={input} type="datetime-local" value={form.endsAt} onChange={(event) => change("endsAt", event.target.value)} /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className={label}>{translate("Repeat")}<select className={input} value={form.repeatFrequency} onChange={(event) => change("repeatFrequency", event.target.value)}><option value="none">{translate("Does not repeat")}</option><option value="daily">{translate("Daily")}</option><option value="weekly">{translate("Weekly")}</option><option value="monthly">{translate("Monthly")}</option></select></label><label className={label}>{translate("Repeat interval")}<input className={input} type="number" min="1" max="30" value={form.repeatInterval} onChange={(event) => change("repeatInterval", event.target.value)} /></label></div>
          {form.repeatFrequency === "weekly" && <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-xs font-semibold text-[#516257]">{translate("Repeat on")}</legend>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <label key={day} className="flex items-center gap-1 text-[11px] text-[#65756a]"><input type="checkbox" checked={form.repeatDays.includes(index)} onChange={(event) => change("repeatDays", event.target.checked ? [...form.repeatDays, index] : form.repeatDays.filter((item) => item !== index))} />{translate(day)}</label>)}</fieldset>}
          <div className="grid gap-3 sm:grid-cols-2"><label className={label}>{translate("Start date")}<input className={input} type="date" value={form.startDate} onChange={(event) => change("startDate", event.target.value)} /></label><label className={label}>{translate("End date")}<input className={input} type="date" value={form.endDate} onChange={(event) => change("endDate", event.target.value)} /></label></div>
        </>}
        {form.category === "meal" && <>
          <label className={label}>{translate("Meal slot")}<select className={input} value={form.mealType} onChange={(event) => change("mealType", event.target.value)}>{["breakfast", "lunch", "dinner", "snack", "custom"].map((item) => <option key={item} value={item}>{translate(item[0].toUpperCase() + item.slice(1))}</option>)}</select></label>
          {form.mealType === "custom" && <label className={label}>{translate("Custom meal slot")}<input className={input} maxLength={60} value={form.categoryLabel} onChange={(event) => change("categoryLabel", event.target.value)} placeholder={translate("For example, afternoon snack")} /></label>}
          <div className="space-y-2"><label className={label}>{translate("Meal photo (JPEG, PNG, or WebP; up to 5 MB)")}<input className={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setMealImage(event.target.files?.[0] || null); setRemoveMealImage(false); }} /></label>{mealImagePreview && <img src={mealImagePreview} alt={translate("Selected meal preview")} className="max-h-40 rounded-xl object-cover" />}{!mealImagePreview && form.mealImageFileId && !removeMealImage && <div className="flex items-center gap-3"><img src={`/api/documents/meals/${form._id}/image`} alt={translate("Saved meal")} className="max-h-32 max-w-48 rounded-xl object-cover" /><button type="button" onClick={() => setRemoveMealImage(true)} className="text-xs text-[#a14d46] underline">{translate("Remove image")}</button></div>}</div>
          <label className={label}>{translate("Ingredients and food preferences")}<textarea className={input} rows="2" maxLength={1200} value={form.ingredients} onChange={(event) => change("ingredients", event.target.value)} /></label>
          <label className="flex items-center gap-2 text-xs text-[#516257]"><input type="checkbox" checked={form.vegetarian} onChange={(event) => change("vegetarian", event.target.checked)} /> {translate("Vegetarian option")}</label>
          <label className={label}>{translate("Preparation or clinician-provided guidance")}<textarea className={input} rows="2" maxLength={2000} value={form.preparation} onChange={(event) => change("preparation", event.target.value)} /></label>
        </>}
        {form.category === "appointment" && <div className="grid gap-3 sm:grid-cols-2">{[["provider", "Provider", 120], ["location", "Location", 250], ["purpose", "Purpose", 300]].map(([key, title, max]) => <label key={key} className={label}>{title}<input className={input} maxLength={max} value={form.appointment?.[key] || ""} onChange={(event) => changeNested("appointment", key, event.target.value)} /></label>)}<label className={`${label} sm:col-span-2`}>Clinician-provided instructions<textarea className={input} maxLength={2000} rows="2" value={form.appointment?.clinicianInstructions || ""} onChange={(event) => changeNested("appointment", "clinicianInstructions", event.target.value)} /></label></div>}
        {form.category === "activity" && <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Movement type<input className={input} maxLength={80} value={form.activityType} onChange={(event) => change("activityType", event.target.value)} placeholder="Walk, stretch, dance…" /></label><label className={label}>Time spent (minutes)<input className={input} type="number" min="1" max="600" value={form.durationMinutes} onChange={(event) => change("durationMinutes", event.target.value)} /></label></div>}
        {form.category === "water" && <div><label className={label}>Amount (ml)<input className={input} type="number" min="1" max="3000" required value={form.amountMl} onChange={(event) => change("amountMl", event.target.value)} /></label><p className="mt-2 text-xs text-[#89958b]">Log what you drank—there's no target to meet.</p></div>}
        {form.category === "checkin" && <div className="grid gap-3 sm:grid-cols-2"><p className="text-xs leading-5 text-[#89958b] sm:col-span-2">Optional reflection for your own notes. Skip anything you don't want to answer.</p>{checkIns.map(([key, title, options]) => <label key={key} className={label}>{title}<select className={input} value={form.checkIn?.[key] || ""} onChange={(event) => changeNested("checkIn", key, event.target.value)}><option value="">Skip</option>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}<label className={`${label} sm:col-span-2`}>Personal observations<textarea className={input} rows="2" maxLength={2000} value={form.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Anything you would like to remember about today…" /></label><fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-[#516257]">Optional measurement</legend><p className="mt-1 text-[11px] text-[#89958b]">For your own record only. HerWell does not interpret measurements.</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><input aria-label="Measurement type" className={input} maxLength={40} placeholder="Type" value={form.measurement?.type || ""} onChange={(event) => changeNested("measurement", "type", event.target.value)} /><input aria-label="Measurement value" className={input} type="number" min="0" max="100000" value={form.measurement?.value ?? ""} onChange={(event) => changeNested("measurement", "value", event.target.value)} /><input aria-label="Measurement unit" className={input} maxLength={20} placeholder="Unit" value={form.measurement?.unit || ""} onChange={(event) => changeNested("measurement", "unit", event.target.value)} /></div></fieldset></div>}
        {form.category === "journal" && <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Mood label<select className={input} value={form.journal?.mood || ""} onChange={(event) => changeNested("journal", "mood", event.target.value)}><option value="">No label</option><option value="low">A little low</option><option value="okay">Okay</option><option value="good">Good</option></select></label><label className={label}>Tags<input className={input} maxLength={200} value={(form.journal?.tags || []).join(", ")} onChange={(event) => changeNested("journal", "tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10))} placeholder="Separate with commas" /></label></div>}
        {["routine", "meal", "reminder", "followup", "appointment", "journal"].includes(form.category) && <label className={label}>{form.category === "journal" ? "Your reflection" : "Notes"}<textarea className={input} rows="3" maxLength="2000" value={form.notes} onChange={(event) => change("notes", event.target.value)} /></label>}
        {form.category !== "water" && <label className={label}>{translate("Date and time")}<input className={input} type="datetime-local" value={form.scheduledAt} onChange={(event) => change("scheduledAt", event.target.value)} /></label>}
        {["routine", "meal", "followup", "appointment"].includes(form.category) && <>
          <label className={label}>Reminder time<input className={input} type="datetime-local" value={form.reminderAt} onChange={(event) => { change("reminderAt", event.target.value); change("reminderEnabled", Boolean(event.target.value)); }} /></label>
          <label className="flex items-center gap-2 text-xs text-[#516257]"><input type="checkbox" checked={form.reminderEnabled} onChange={(event) => change("reminderEnabled", event.target.checked)} /> Enable reminder</label>
        </>}
        {form.category === "reminder" && <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Repeat<select className={input} value={form.repeatFrequency} onChange={(event) => change("repeatFrequency", event.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label className={label}>Every<input className={input} type="number" min="1" max="30" value={form.repeatInterval} onChange={(event) => change("repeatInterval", event.target.value)} /></label></div>}
        {form.category === "reminder" && <label className={label}>Link to item<select className={input} value={form.linkRecordId || ""} onChange={(event) => change("linkRecordId", event.target.value)}><option value="">No linked item</option>{records.filter((item) => item.category !== "reminder").map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="rounded-lg px-4 py-2.5 text-sm text-[#78867c] hover:bg-[#f4f6f2]" onClick={onClose}>{translate("Cancel")}</button><button disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#2f5b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264b39] disabled:opacity-60">{busy ? translate("Saving…") : translate("Save to my space")}<ArrowRight size={16} /></button></div>
      </form>
    </section>
  </div>;
}
