import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  pendingEmail: { type: String, lowercase: true, trim: true, maxlength: 254, default: null },
  passwordHash: { type: String, required: true, select: false },
  emailVerifiedAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0 },
  avatarFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  profile: {
    dateOfBirth: { type: Date, default: null },
    phone: { type: String, trim: true, maxlength: 32, default: "" },
    timeZone: { type: String, trim: true, maxlength: 80, default: "UTC" },
    language: { type: String, enum: ["en", "es"], default: "en" },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    quietHoursStart: { type: String, default: "" },
    quietHoursEnd: { type: String, default: "" },
    notificationsEnabled: { type: Boolean, default: true },
  },
}, { timestamps: true });

const recordSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  category: { type: String, enum: ["routine", "meal", "appointment", "journal", "activity", "water", "checkin", "reminder", "followup"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  scheduledAt: { type: Date, default: null },
  completed: { type: Boolean, default: false },
  status: { type: String, enum: ["planned", "completed", "skipped", "cancelled"], default: "planned" },
  completionHistory: [{ status: { type: String, enum: ["completed", "skipped", "rescheduled"], required: true }, at: { type: Date, default: Date.now } }],
  occurrences: [{ dateKey: { type: String, required: true }, status: { type: String, enum: ["completed", "skipped", "planned"], required: true }, updatedAt: { type: Date, default: Date.now } }],
  supporterUpdates: [{ author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, note: { type: String, required: true, trim: true, maxlength: 1000 }, createdAt: { type: Date, default: Date.now } }],
  categoryLabel: { type: String, trim: true, maxlength: 60, default: "" },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  recurrence: {
    frequency: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
    interval: { type: Number, min: 1, max: 30, default: 1 },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startDateKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDateKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  mealImageFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  reminderAt: { type: Date, default: null },
  reminderEnabled: { type: Boolean, default: false },
  reminderDismissedAt: { type: Date, default: null },
  linkRecordId: { type: mongoose.Schema.Types.ObjectId, default: null },
  appointment: {
    provider: { type: String, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 250 },
    purpose: { type: String, trim: true, maxlength: 300 },
    clinicianInstructions: { type: String, trim: true, maxlength: 2000 },
  },
  journal: {
    mood: { type: String, enum: ["low", "okay", "good"] },
    tags: [{ type: String, trim: true, maxlength: 30 }],
  },
  mealType: { type: String, enum: ["breakfast", "lunch", "dinner", "snack", "custom"], default: undefined },
  vegetarian: { type: Boolean, default: false },
  ingredients: { type: String, trim: true, maxlength: 1200, default: "" },
  preparation: { type: String, trim: true, maxlength: 2000, default: "" },
  activityType: { type: String, trim: true, maxlength: 80, default: "" },
  durationMinutes: { type: Number, min: 1, max: 600, default: undefined },
  amountMl: { type: Number, min: 1, max: 3000, default: undefined },
  measurement: {
    type: { type: String, trim: true, maxlength: 40 },
    value: { type: Number, min: 0, max: 100000 },
    unit: { type: String, trim: true, maxlength: 20 },
  },
  checkIn: {
    mood: { type: String, enum: ["low", "okay", "good"] },
    energy: { type: String, enum: ["low", "okay", "good"] },
    sleep: { type: String, enum: ["restless", "okay", "restful"] },
    appetite: { type: String, enum: ["less", "usual", "more"] },
    digestion: { type: String, enum: ["noticeable", "okay", "comfortable"] },
  },
}, { timestamps: true });

const tokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ["verify-email", "reset-password", "change-email"], required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

const supporterSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  supporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  status: { type: String, enum: ["pending", "accepted", "revoked", "rejected"], default: "pending" },
  permissions: [{ type: String, enum: ["routines", "meals", "reminders", "appointments", "followups", "notes", "documents"] }],
  inviteTokenHash: { type: String, default: null },
  inviteExpiresAt: { type: Date, default: null },
  history: [{ action: { type: String, required: true }, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, maxlength: 120 },
  record: { type: mongoose.Schema.Types.ObjectId, ref: "Record", default: null },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: ["pending", "sending", "sent", "snoozed", "dismissed"], default: "pending" },
  snoozedUntil: { type: Date, default: null },
  retryAt: { type: Date, default: null },
  occurrenceKey: { type: String, default: "single" },
  occurrenceAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index(
  { owner: 1, record: 1, occurrenceKey: 1 },
  { unique: true, partialFilterExpression: { record: { $type: "objectId" } } },
);

const pushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  endpoint: { type: String, required: true },
  keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
}, { timestamps: true });
pushSubscriptionSchema.index({ user: 1, endpoint: 1 }, { unique: true });

const documentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  category: { type: String, enum: ["report", "prescription", "test-result", "other"], default: "other" },
  documentDate: { type: Date, default: null },
  contentType: { type: String, required: true },
  filename: { type: String, required: true, maxlength: 180 },
  size: { type: Number, required: true, max: 10 * 1024 * 1024 },
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
export const Record = mongoose.model("Record", recordSchema);
export const AuthToken = mongoose.model("AuthToken", tokenSchema);
export const SupporterAccess = mongoose.model("SupporterAccess", supporterSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const MedicalDocument = mongoose.model("MedicalDocument", documentSchema);
export const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
