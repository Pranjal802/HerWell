import { Router } from "express";
import mongoose from "mongoose";
import webpush from "web-push";
import { Notification, PushSubscription, Record, User } from "./models.js";
import { requireAuth } from "./auth.js";
import { dateTimeInTimeZone, isValidDateKey, nextOccurrenceKey } from "./recurrence.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const publicKey = process.env.VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "";
const pushConfigured = Boolean(publicKey && privateKey && vapidSubject);
if (pushConfigured) webpush.setVapidDetails(vapidSubject, publicKey, privateKey);

notificationsRouter.get("/push/config", (_req, res) => res.json({ enabled: pushConfigured, publicKey: pushConfigured ? publicKey : null }));

notificationsRouter.post("/push/subscriptions", async (req, res, next) => {
  try {
    const subscription = req.body.subscription;
    if (!pushConfigured) return res.status(503).json({ message: "Push notifications are not configured on this server yet." });
    if (!subscription || typeof subscription !== "object" || typeof subscription.endpoint !== "string"
      || subscription.endpoint.length > 2048 || !subscription.endpoint.startsWith("https://")
      || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string"
      || subscription.keys.p256dh.length > 256 || subscription.keys.auth.length > 256) {
      return res.status(400).json({ message: "Choose a valid browser push subscription." });
    }
    await PushSubscription.findOneAndUpdate(
      { user: req.userId, endpoint: subscription.endpoint },
      { $set: { keys: subscription.keys } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(201).json({ message: "Background notifications are enabled on this device." });
  } catch (error) { return next(error); }
});

notificationsRouter.delete("/push/subscriptions", async (req, res, next) => {
  try {
    const endpoint = typeof req.body.endpoint === "string" ? req.body.endpoint : "";
    if (endpoint) await PushSubscription.deleteOne({ user: req.userId, endpoint });
    else await PushSubscription.deleteMany({ user: req.userId });
    return res.json({ message: "Background notifications are turned off on this device." });
  } catch (error) { return next(error); }
});

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.find({ owner: req.userId })
      .sort({ scheduledAt: -1 }).limit(200).lean();
    return res.json({ notifications });
  } catch (error) { return next(error); }
});

notificationsRouter.post("/:id/action", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "That reminder wasn't found." });
    const action = req.body.action;
    if (!["dismiss", "snooze", "delivered"].includes(action)) return res.status(400).json({ message: "Choose snooze, dismiss, or delivered." });
    const notification = await Notification.findOne({ _id: req.params.id, owner: req.userId, status: { $in: ["pending", "snoozed", "sent"] } });
    if (!notification) return res.status(404).json({ message: "That active reminder wasn't found." });
    const record = notification.record ? await Record.findOne({ _id: notification.record, owner: req.userId }) : null;
    if (action === "delivered") {
      if (notification.status === "sent") return res.status(409).json({ message: "That reminder has already been delivered." });
      if (notification.scheduledAt > new Date()) return res.status(400).json({ message: "That reminder isn't due yet." });
      notification.status = "sent";
      notification.retryAt = null;
    } else if (action === "dismiss") {
      notification.status = "dismissed";
      if (record) {
        record.reminderDismissedAt = new Date();
        if (record.recurrence?.frequency === "none") record.reminderEnabled = false;
        await record.save();
      }
    } else {
      const minutes = Number(req.body.minutes);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) return res.status(400).json({ message: "Choose a snooze between 5 minutes and 24 hours." });
      const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
      notification.status = "snoozed";
      notification.snoozedUntil = snoozedUntil;
      notification.scheduledAt = snoozedUntil;
      notification.retryAt = null;
    }
    await notification.save();
    if (["delivered", "dismiss"].includes(action) && record?.reminderEnabled && record.recurrence?.frequency !== "none") {
      const owner = await User.findById(req.userId).select("profile").lean();
      await queueNextOccurrence(notification, record, owner?.profile?.timeZone || "UTC");
    }
    return res.json({ notification });
  } catch (error) { return next(error); }
});

function isQuietTime(profile, now) {
  const { quietHoursStart: start, quietHoursEnd: end, timeZone = "UTC" } = profile || {};
  if (!start || !end || start === end) return false;
  const current = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function localDateParts(date, timeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
}

function dateKey(date, timeZone = "UTC") {
  const parts = localDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function queueNextOccurrence(notification, record, timeZone = "UTC") {
  const current = notification.occurrenceAt || notification.scheduledAt;
  const currentKey = isValidDateKey(notification.occurrenceKey) ? notification.occurrenceKey : dateKey(current, timeZone);
  const nextKey = nextOccurrenceKey(currentKey, record.recurrence);
  if (!nextKey) return;
  const { startDateKey, endDateKey } = record.recurrence || {};
  if ((startDateKey && nextKey < startDateKey) || (endDateKey && nextKey > endDateKey)) return;
  const localTime = localDateParts(current, timeZone);
  const next = dateTimeInTimeZone(nextKey, Number(localTime.hour), Number(localTime.minute), timeZone);
  if (next <= new Date()) return;
  try {
    await Notification.findOneAndUpdate(
      { owner: record.owner, record: record._id, occurrenceKey: nextKey },
      { $setOnInsert: { title: record.title, scheduledAt: next, occurrenceAt: next, status: "pending" } },
      { upsert: true, new: true, runValidators: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}

async function deliverDueNotifications() {
  if (!pushConfigured) return;
  const now = new Date();
  await Notification.updateMany(
    { status: "sending", updatedAt: { $lt: new Date(now.getTime() - 2 * 60 * 1000) } },
    { $set: { status: "pending", retryAt: now } },
  );
  const due = await Notification.find({
    status: { $in: ["pending", "snoozed"] },
    scheduledAt: { $lte: now },
    $or: [{ retryAt: null }, { retryAt: { $lte: now } }],
  }).sort({ scheduledAt: 1 }).limit(100).lean();
  for (const candidate of due) {
    const [user, subscriptions] = await Promise.all([
      User.findById(candidate.owner).select("profile").lean(),
      PushSubscription.find({ user: candidate.owner }).lean(),
    ]);
    if (!user || user.profile?.notificationsEnabled === false || !subscriptions.length) continue;
    if (isQuietTime(user.profile, now)) continue;
    const claimed = await Notification.findOneAndUpdate(
      { _id: candidate._id, status: { $in: ["pending", "snoozed"] }, scheduledAt: { $lte: now }, $or: [{ retryAt: null }, { retryAt: { $lte: now } }] },
      { $set: { status: "sending", retryAt: null } },
      { new: true },
    );
    if (!claimed) continue;
    const payload = JSON.stringify({ title: "HerWell reminder", body: "A reminder is ready in your private space.", url: "/reminders", notificationId: claimed.id });
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload, { TTL: 3600 });
        return true;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
          return false;
        }
        throw error;
      }
    }));
    const delivered = results.some((result) => result.status === "fulfilled" && result.value);
    for (const result of results) if (result.status === "rejected") console.error("Push delivery failed:", result.reason.message);
    if (delivered) {
      claimed.status = "sent";
      await claimed.save();
      const record = claimed.record ? await Record.findOne({ _id: claimed.record, owner: claimed.owner }) : null;
      if (record?.reminderEnabled && record.recurrence?.frequency !== "none") {
        await queueNextOccurrence(claimed, record, user.profile?.timeZone || "UTC");
      }
    } else {
      claimed.status = "pending";
      claimed.retryAt = new Date(Date.now() + 5 * 60 * 1000);
      await claimed.save();
    }
  }
}

export function startNotificationScheduler() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await deliverDueNotifications(); }
    catch (error) { console.error("Reminder scheduler failed:", error.message); }
    finally { running = false; }
  }, 15_000);
  timer.unref();
}
