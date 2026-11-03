import { useState } from "react";
import {
  ArrowRight, CalendarDays, Check, Clock3, HeartPulse, Plus, Utensils,
} from "lucide-react";
import { Link } from "react-router-dom";
import RecordForm from "../components/RecordForm.jsx";
import { occursOn, occurrenceStatus } from "../lib/recurrence.js";
import { localeFor, translate } from "../lib/translations.js";

const actionableCategories = new Set(["routine", "meal", "reminder"]);
const upcomingCategories = new Set(["routine", "meal", "reminder", "appointment", "followup"]);

function isForToday(record, now) {
  if (record.recurrence?.frequency && record.recurrence.frequency !== "none") {
    return occursOn(record, now);
  }
  const date = record.scheduledAt || record.createdAt;
  return Boolean(date && new Date(date).toDateString() === now.toDateString());
}

function greetingFor(hour) {
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function formatTime(date) {
  return new Intl.DateTimeFormat(localeFor(), { timeStyle: "short" }).format(new Date(date));
}

function isPlanned(record, now) {
  return occurrenceStatus(record, now) === "planned";
}

function ProgressRing({ completed, total }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = total ? completed / total : 0;
  return (
    <svg className="today-progress-ring" viewBox="0 0 96 96" role="img" aria-label={`${completed} of ${total} planned items done today`}>
      <defs>
        <linearGradient id="today-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="80%" stopColor="var(--color-primary-200)" />
          <stop offset="100%" stopColor="var(--color-win-500)" />
        </linearGradient>
      </defs>
      <circle className="today-progress-track" cx="48" cy="48" r={radius} />
      {total > 0 && <circle
        className="today-progress-value"
        cx="48"
        cy="48"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />}
      <text className="today-progress-number" x="48" y="46">{completed}</text>
      <text className="today-progress-caption" x="48" y="61">of {total}</text>
    </svg>
  );
}

function IconCircle({ children, category = "routine" }) {
  return <span className={`today-icon-circle is-${category}`} aria-hidden="true">{children}</span>;
}

function TodaySection({ title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`today-section ${className}`}>
      <header className="today-section-heading">
        <span className="today-section-title"><Icon size={20} strokeWidth={2} /><h2>{title}</h2></span>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptySection({ children }) {
  return <p className="today-empty-copy">{children}</p>;
}

function MealPhoto({ record }) {
  const [available, setAvailable] = useState(true);
  if (!record.mealImageFileId || !available) {
    return <span className="today-meal-photo-placeholder"><Utensils size={22} /></span>;
  }
  return <img
    className="today-meal-photo"
    src={`/api/documents/meals/${record._id}/image`}
    alt=""
    onError={() => setAvailable(false)}
  />;
}

export default function DashboardPage({ user, records, onSave, onToggle }) {
  const [form, setForm] = useState(null);
  const now = new Date();
  const todayRecords = records.filter((record) => isForToday(record, now));
  const dailyItems = todayRecords.filter((record) => actionableCategories.has(record.category));
  const routines = todayRecords.filter((record) => record.category === "routine");
  const meals = todayRecords.filter((record) => record.category === "meal");
  const reminders = todayRecords.filter((record) => record.category === "reminder");
  const completed = dailyItems.filter((record) => occurrenceStatus(record, now) === "completed").length;
  const firstName = user.name.split(" ")[0];
  const hideAppointmentDetails = user.profile?.hideAppointmentDetailsOnDashboard !== false;
  const dateLabel = new Intl.DateTimeFormat(localeFor(), { weekday: "long", day: "numeric", month: "long" }).format(now);
  const appointments = records
    .filter((record) => ["appointment", "followup"].includes(record.category)
      && record.scheduledAt && new Date(record.scheduledAt) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
      && record.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 2);
  const nextItem = records
    .filter((record) => upcomingCategories.has(record.category)
      && record.scheduledAt && new Date(record.scheduledAt) >= now
      && isPlanned(record, now))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0]
    || routines.find((record) => isPlanned(record, now))
    || reminders.find((record) => isPlanned(record, now));
  const hasCheckIn = todayRecords.some((record) => record.category === "checkin");
  const openForm = (category) => setForm({ category });

  return (
    <div className="today-page">
      <header className="today-greeting">
        <div>
          <p className="today-date">{dateLabel}</p>
          <h1>{translate(greetingFor(now.getHours()))} {firstName}.</h1>
          <p className="today-greeting-subtitle">
            {dailyItems.length ? translate("One step at a time. You're doing well.") : translate("A calm day ahead. Make it your own.")}
          </p>
        </div>
      </header>

      <section className="today-hero" aria-labelledby="today-progress-title">
        <div className="today-hero-copy">
          <p className="today-eyebrow">{translate("YOUR DAY, AT A GLANCE")}</p>
          <h2 id="today-progress-title">
            {dailyItems.length > 0 && completed === dailyItems.length
              ? translate("Strong day")
              : `${completed} ${translate("of")} ${dailyItems.length} ${translate("done today")}`}
          </h2>
          <p>{dailyItems.length ? translate("Every small step counts.") : translate("Start with one small win.")}</p>
          <div className="today-progress-chips" aria-label="Today's progress by category">
            <span>{translate("Routines")} {routines.filter((item) => occurrenceStatus(item, now) === "completed").length}/{routines.length}</span>
            <span>{translate("Meals")} {meals.filter((item) => occurrenceStatus(item, now) === "completed").length}/{meals.length}</span>
            <span>{translate("Reminders")} {reminders.filter((item) => occurrenceStatus(item, now) === "completed").length}/{reminders.length}</span>
          </div>
        </div>
        <ProgressRing completed={completed} total={dailyItems.length} />
        <button className="today-energy-button" onClick={() => openForm("routine")}>
          <Plus size={18} />{translate(!dailyItems.length || completed === dailyItems.length ? "Add something" : "Keep going")}
        </button>
      </section>

      {nextItem && <section className={`today-next-card${["appointment", "followup"].includes(nextItem.category) ? " is-warm" : ""}`}>
        <IconCircle category={nextItem.category}>
          {nextItem.category === "meal" ? <Utensils size={20} /> : nextItem.category === "appointment" || nextItem.category === "followup" ? <CalendarDays size={20} /> : <Clock3 size={20} />}
        </IconCircle>
        <div className="today-next-copy">
          <p className="today-eyebrow">{translate("NEXT UP")}</p>
          <h2>{["appointment", "followup"].includes(nextItem.category) && hideAppointmentDetails
            ? translate(nextItem.category === "appointment" ? "Appointment" : "Follow-up")
            : nextItem.title}</h2>
          <p>{nextItem.scheduledAt ? formatTime(nextItem.scheduledAt) : translate("Still open")}</p>
        </div>
        {actionableCategories.has(nextItem.category)
          ? <button className="today-small-action" onClick={() => onToggle(nextItem)}>{translate("Mark done")}</button>
          : <Link className="today-small-action" to={nextItem.category === "appointment" ? "/healthcare" : "/calendar"}>{translate("View")}</Link>}
      </section>}

      {dailyItems.length === 0 ? <section className="today-first-day">
        <h2>{translate("Let's set up your first day")}</h2>
        <p>{translate("Choose one small thing to plan. You can change it anytime.")}</p>
        <div>
          <button onClick={() => openForm("routine")}><Plus size={18} />{translate("Add a routine")}</button>
          <button onClick={() => openForm("meal")}><Plus size={18} />{translate("Add a meal")}</button>
          <button onClick={() => openForm("reminder")}><Plus size={18} />{translate("Add a reminder")}</button>
        </div>
      </section> : <div className="today-columns">
        <div className="today-column">
          <TodaySection title={translate("Today's routine")} icon={Check} action={<Link to="/planner" className="today-text-link">{translate("See all")}<ArrowRight size={16} /></Link>}>
            {routines.length ? <div className="today-list-card">
              {routines.slice(0, 4).map((record) => {
                const done = occurrenceStatus(record, now) === "completed";
                return <div className={`today-routine-row${done ? " is-done" : ""}`} key={record._id}>
                  <button className="today-check" aria-label={translate(done ? "Mark as not done" : "Mark as done")} aria-pressed={done} onClick={() => onToggle(record)}>
                    {done && <Check size={16} />}
                  </button>
                  <span className="today-routine-name">{record.title}</span>
                  {record.scheduledAt && <time>{formatTime(record.scheduledAt)}</time>}
                </div>;
              })}
            </div> : <EmptySection>{translate("Start with one small win.")}</EmptySection>}
          </TodaySection>

          <TodaySection title={translate("Today's meals")} icon={Utensils} action={<Link to="/meals" className="today-text-link">{translate("See all")}<ArrowRight size={16} /></Link>}>
            {meals.length ? <div className="today-meal-list">
              {meals.slice(0, 4).map((meal) => <Link className="today-meal-card" to="/meals" key={meal._id}>
                <MealPhoto record={meal} />
                <span className="today-meal-type">{translate(meal.mealType || "Meal")}</span>
                <strong>{meal.title}</strong>
                <span className="today-meal-state">{translate(occurrenceStatus(meal, now) === "completed" ? "Logged" : "Planned")}</span>
              </Link>)}
            </div> : <EmptySection>{translate("Add a meal when it helps you plan your day.")}</EmptySection>}
          </TodaySection>
        </div>

        <div className="today-column">
          <TodaySection title={translate("Reminders")} icon={Clock3} action={<Link to="/reminders" className="today-text-link">{translate("See all")}<ArrowRight size={16} /></Link>}>
            {reminders.filter((item) => isPlanned(item, now)).length
              ? <div className="today-list-card">
                {reminders.filter((item) => isPlanned(item, now)).slice(0, 3).map((reminder) => <div className="today-reminder-row" key={reminder._id}>
                  <IconCircle category="reminder"><Clock3 size={18} /></IconCircle>
                  <span className="today-reminder-copy"><strong>{reminder.title}</strong><small>{reminder.scheduledAt ? formatTime(reminder.scheduledAt) : translate("Still open")}</small></span>
                  <button className="today-check" aria-label={translate("Mark as done")} onClick={() => onToggle(reminder)}><Check size={16} /></button>
                </div>)}
              </div> : <EmptySection>{translate("You're all caught up.")}</EmptySection>}
          </TodaySection>

          {!hasCheckIn && <section className="today-checkin-card">
            <IconCircle category="wellness"><HeartPulse size={20} /></IconCircle>
            <div><h2>{translate("How are you feeling today?")}</h2><p>{translate("A check-in is optional. Add one whenever useful.")}</p></div>
            <button className="today-secondary-button" onClick={() => openForm("checkin")}>{translate("Quick check-in")}</button>
          </section>}

          <TodaySection title={translate("Upcoming appointments")} icon={CalendarDays} action={<Link to="/healthcare" className="today-text-link">{translate("See all")}<ArrowRight size={16} /></Link>}>
            {appointments.length ? <div className="today-list-card">
              {appointments.map((appointment) => <div className="today-appointment-row" key={appointment._id}>
                <time dateTime={appointment.scheduledAt}>
                  <strong>{new Intl.DateTimeFormat(localeFor(), { day: "numeric" }).format(new Date(appointment.scheduledAt))}</strong>
                  <span>{new Intl.DateTimeFormat(localeFor(), { month: "short" }).format(new Date(appointment.scheduledAt))}</span>
                </time>
                <span><strong>{hideAppointmentDetails ? translate(appointment.category === "appointment" ? "Appointment" : "Follow-up") : appointment.title}</strong><small>{formatTime(appointment.scheduledAt)}</small></span>
              </div>)}
            </div> : <EmptySection>{translate("No upcoming appointments.")}</EmptySection>}
          </TodaySection>
        </div>
      </div>}

      {form && <RecordForm initial={form} records={records} onClose={() => setForm(null)} onSave={onSave} />}
    </div>
  );
}
