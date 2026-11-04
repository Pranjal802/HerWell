import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import { User, Record, AuthToken, MedicalDocument, Notification, SupporterAccess, PushSubscription } from "./models.js";
import { cookieOptions, optionalAuth, requireAuth } from "./auth.js";
import { sendAccountEmail, sendVerificationEmail } from "./email.js";
import { isOccurrenceDate, isValidDateKey } from "./recurrence.js";
import { getBucket } from "./documents.js";

export const authRouter = Router();
export const recordsRouter = Router();

const recordCategories = ["routine", "meal", "appointment", "journal", "activity", "water", "checkin", "reminder", "followup"];
const mealTypes = ["breakfast", "lunch", "dinner", "snack", "custom"];
const frequencies = ["none", "daily", "weekly", "monthly"];
const recordStatuses = ["planned", "completed", "skipped", "cancelled"];
const checkInOptions = {
  mood: ["low", "okay", "good"],
  energy: ["low", "okay", "good"],
  sleep: ["restless", "okay", "restful"],
  appetite: ["less", "usual", "more"],
  digestion: ["noticeable", "okay", "comfortable"],
};
const profileFields = ["dateOfBirth", "phone", "timeZone", "language", "theme", "quietHoursStart", "quietHoursEnd", "notificationsEnabled", "hideAppointmentDetailsOnDashboard"];

async function writeResponseChunk(res, chunk) {
  if (res.write(chunk)) return;
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      res.off("drain", onDrain);
      res.off("error", onError);
      res.off("close", onClose);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = (error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("The client disconnected during data export.")); };
    res.once("drain", onDrain);
    res.once("error", onError);
    res.once("close", onClose);
  });
}

function isValidDate(value) {
  return value == null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

function isValidRecurrence(value) {
  if (value === undefined) return true;
  return value && typeof value === "object" && !Array.isArray(value)
    && frequencies.includes(value.frequency)
    && (value.interval === undefined || (Number.isInteger(value.interval) && value.interval >= 1 && value.interval <= 30))
    && (value.daysOfWeek === undefined || (Array.isArray(value.daysOfWeek) && value.daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    && (value.startDateKey === undefined || isValidDateKey(value.startDateKey))
    && (value.endDateKey === undefined || isValidDateKey(value.endDateKey))
    && !(value.startDateKey && value.endDateKey && value.endDateKey < value.startDateKey);
}

function issueSession(user, res) {
  const token = jwt.sign({ sub: user.id, ver: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("herwell_session", token, cookieOptions);
  return { token, id: user.id, name: user.name, email: user.email, profile: user.profile };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createEmailToken(user, purpose) {
  const rawToken = randomBytes(32).toString("base64url");
  await AuthToken.deleteMany({ user: user._id, purpose });
  await AuthToken.create({
    user: user._id,
    tokenHash: hashToken(rawToken),
    purpose,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return rawToken;
}

async function sendActionEmail(user, purpose, rawToken) {
  const link = new URL("/", process.env.APP_ORIGIN || "http://localhost:5173");
  const queryKey = { "verify-email": "verifyEmail", "reset-password": "resetPassword", "change-email": "changeEmail" }[purpose];
  link.searchParams.set(queryKey, rawToken);
  if (purpose === "verify-email") {
    await sendVerificationEmail({ to: user.email, link: link.href });
    return;
  }
  const description = { "verify-email": "verify your email address", "reset-password": "reset your password", "change-email": "confirm your new email address" }[purpose];
  await sendAccountEmail({
    to: purpose === "change-email" ? user.pendingEmail : user.email,
    subject: { "verify-email": "Verify your HerWell email", "reset-password": "Reset your HerWell password", "change-email": "Confirm your new HerWell email" }[purpose],
    text: `Use this link to ${description}. It expires in one hour:\n\n${link}\n\nIf you did not request this, you can ignore this message.`,
  });
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 1 || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 72) {
      return res.status(400).json({ message: "Enter a name, a valid email address, and a password between 8 and 72 characters." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = await createEmailToken(user, "verify-email");
    try {
      await sendActionEmail(user, "verify-email", token);
    } catch (error) {
      await AuthToken.deleteOne({ user: user._id, purpose: "verify-email", tokenHash: hashToken(token) });
      console.error("Verification email delivery failed:", error.message);
      return res.status(201).json({
        message: "Your account was created, but the verification message could not be delivered. Use Resend verification on the sign-in screen to try again.",
      });
    }
    const message = process.env.NODE_ENV === "development"
      ? "Your account was created. Open the verification link printed in the backend terminal before signing in."
      : "Check your email for a verification link before signing in.";
    return res.status(201).json({ message });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with that email already exists." });
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "That email and password don't match. Please try again." });
    }
    if (!user.emailVerifiedAt) return res.status(403).json({ message: "Please verify your email before signing in." });
    const session = issueSession(user, res); return res.json({ token: session.token, user: session });
  } catch (error) { return next(error); }
});

authRouter.post("/verify-email", async (req, res, next) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token : "";
    const authToken = await AuthToken.findOne({ tokenHash: hashToken(token), purpose: "verify-email", expiresAt: { $gt: new Date() } });
    if (!authToken) return res.status(400).json({ message: "This verification link is invalid or has expired. Request a new one." });
    const user = await User.findByIdAndUpdate(authToken.user, { emailVerifiedAt: new Date() }, { new: true });
    await AuthToken.deleteMany({ user: authToken.user, purpose: "verify-email" });
    if (!user) return res.status(400).json({ message: "This account could not be found." });
    const session = issueSession(user, res); return res.json({ token: session.token, user: session });
  } catch (error) { return next(error); }
});

authRouter.post("/resend-verification", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const user = await User.findOne({ email });
    if (user && !user.emailVerifiedAt) {
      const token = await createEmailToken(user, "verify-email");
      try {
        await sendActionEmail(user, "verify-email", token);
      } catch (error) {
        await AuthToken.deleteOne({ user: user._id, purpose: "verify-email", tokenHash: hashToken(token) });
        return next(error);
      }
    }
    return res.json({ message: "If that account needs verification, an email has been sent." });
  } catch (error) { return next(error); }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const user = await User.findOne({ email, emailVerifiedAt: { $ne: null } });
    if (user) {
      const token = await createEmailToken(user, "reset-password");
      await sendActionEmail(user, "reset-password", token);
    }
    return res.json({ message: "If that verified account exists, a reset link has been sent." });
  } catch (error) { return next(error); }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (password.length < 8 || password.length > 72) return res.status(400).json({ message: "Use a password between 8 and 72 characters." });
    const authToken = await AuthToken.findOne({ tokenHash: hashToken(token), purpose: "reset-password", expiresAt: { $gt: new Date() } });
    if (!authToken) return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
    await User.findByIdAndUpdate(authToken.user, { passwordHash: await bcrypt.hash(password, 12), $inc: { tokenVersion: 1 } });
    await AuthToken.deleteMany({ user: authToken.user });
    return res.json({ message: "Your password has been updated. You can now sign in." });
  } catch (error) { return next(error); }
});

authRouter.post("/change-email/request", requireAuth, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: "Enter a valid email address." });
    const user = await User.findById(req.userId).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(403).json({ message: "Your current password didn't match." });
    if (email === user.email) return res.status(400).json({ message: "That is already your account email address." });
    if (await User.exists({ email })) return res.status(409).json({ message: "An account with that email already exists." });
    user.pendingEmail = email;
    await user.save();
    const token = await createEmailToken(user, "change-email");
    try {
      await sendActionEmail(user, "change-email", token);
    } catch (error) {
      user.pendingEmail = null;
      await user.save();
      await AuthToken.deleteMany({ user: user._id, purpose: "change-email" });
      return next(error);
    }
    return res.json({ message: "Check your new email address for a confirmation link. Your current email remains active until you confirm." });
  } catch (error) { return next(error); }
});

authRouter.post("/change-email/confirm", async (req, res, next) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token : "";
    const authToken = await AuthToken.findOne({ tokenHash: hashToken(token), purpose: "change-email", expiresAt: { $gt: new Date() } });
    if (!authToken) return res.status(400).json({ message: "This email confirmation link is invalid or has expired. Request a new one." });
    const user = await User.findOne({ _id: authToken.user, pendingEmail: { $ne: null } });
    if (!user) return res.status(400).json({ message: "There is no pending email change for this link." });
    const updated = await User.findOneAndUpdate(
      { _id: user._id, pendingEmail: user.pendingEmail },
      { $set: { email: user.pendingEmail, pendingEmail: null, emailVerifiedAt: new Date() }, $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true },
    ).select("name email profile");
    if (!updated) return res.status(400).json({ message: "Your email change could not be completed. Request a new confirmation link." });
    await AuthToken.deleteMany({ user: user._id });
    res.clearCookie("herwell_session", { ...cookieOptions, maxAge: undefined });
    return res.json({ message: "Your email address has been updated. Please sign in again." });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with that email now exists. Your current email is unchanged." });
    return next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  const token = req.cookies?.herwell_session;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      await User.updateOne({ _id: payload.sub, tokenVersion: payload.ver }, { $inc: { tokenVersion: 1 } });
    } catch (error) {
      if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError" && error.name !== "NotBeforeError") return next(error);
    }
  }
  res.clearCookie("herwell_session", { ...cookieOptions, maxAge: undefined });
  return res.json({ message: "Signed out." });
});

authRouter.get("/me", optionalAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.json({ user: null });
    const user = await User.findById(req.userId).select("name email profile emailVerifiedAt");
    if (!user) return res.status(401).json({ message: "Please sign in to continue." });
    if (!user.emailVerifiedAt) return res.status(403).json({ message: "Please verify your email before signing in." });
    return res.json({ user: { id: user.id, name: user.name, email: user.email, profile: user.profile } });
  } catch (error) { return next(error); }
});

authRouter.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim() || req.body.name.trim().length > 60) return res.status(400).json({ message: "Enter a name between 1 and 60 characters." });
      updates.name = req.body.name.trim();
    }
    for (const field of profileFields) {
      if (req.body[field] === undefined) continue;
      const value = req.body[field];
      if (field === "notificationsEnabled" || field === "hideAppointmentDetailsOnDashboard") {
        if (typeof value !== "boolean") return res.status(400).json({ message: `Choose whether ${field === "notificationsEnabled" ? "notifications" : "appointment details"} are hidden or enabled.` });
        updates[`profile.${field}`] = value;
      } else if (field === "dateOfBirth") {
        if (value !== "" && value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value) > new Date())) return res.status(400).json({ message: "Choose a valid date of birth." });
        updates[`profile.${field}`] = value || null;
      } else if (field === "language") {
        if (!["en", "es"].includes(value)) return res.status(400).json({ message: "Choose a supported language." });
        updates[`profile.${field}`] = value;
      } else if (typeof value === "string" && value.length <= 80) {
        updates[`profile.${field}`] = value.trim();
      } else return res.status(400).json({ message: `Check the ${field} setting.` });
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: "There are no valid profile changes to save." });
    if (updates["profile.theme"] !== undefined && !["light", "dark", "system"].includes(updates["profile.theme"])) return res.status(400).json({ message: "Choose a supported theme." });
    if (updates["profile.timeZone"] !== undefined) {
      try { new Intl.DateTimeFormat("en", { timeZone: updates["profile.timeZone"] }); }
      catch { return res.status(400).json({ message: "Choose a valid time zone, such as America/New_York." }); }
    }
    for (const field of ["quietHoursStart", "quietHoursEnd"]) {
      const key = `profile.${field}`;
      if (updates[key] !== undefined && updates[key] !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(updates[key])) return res.status(400).json({ message: "Use a 24-hour time for quiet hours." });
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true, runValidators: true }).select("name email profile");
    return res.json({ user: { id: user.id, name: user.name, email: user.email, profile: user.profile } });
  } catch (error) { return next(error); }
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
    if (newPassword.length < 8 || newPassword.length > 72) return res.status(400).json({ message: "Use a password between 8 and 72 characters." });
    const user = await User.findById(req.userId).select("+passwordHash");
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(403).json({ message: "Your current password didn't match." });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1;
    await user.save();
    await AuthToken.deleteMany({ user: user._id });
    return res.json({ message: "Your password has been changed. Please sign in again." });
  } catch (error) { return next(error); }
});

authRouter.get("/export", requireAuth, async (req, res, next) => {
  try {
    const [user, records, documents, notifications, supporterAccess] = await Promise.all([
      User.findById(req.userId).select("name email emailVerifiedAt profile avatarFileId createdAt updatedAt").lean(),
      Record.find({ owner: req.userId }).select("-__v").lean(),
      MedicalDocument.find({ owner: req.userId }).select("-owner -__v").lean(),
      Notification.find({ owner: req.userId }).select("-owner -__v").lean(),
      SupporterAccess.find({ $or: [{ owner: req.userId }, { supporter: req.userId }] }).select("-inviteTokenHash -__v").lean(),
    ]);
    res.setHeader("Content-Disposition", 'attachment; filename="herwell-export.json"');
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    const { avatarFileId, ...profile } = user;
    const bucket = mongoose.connection.db ? getBucket() : null;
    await writeResponseChunk(res, `{"exportedAt":${JSON.stringify(new Date().toISOString())},"user":${JSON.stringify(profile)},"records":[`);
    for (let index = 0; index < records.length; index += 1) {
      if (index) await writeResponseChunk(res, ",");
      const { mealImageFileId, ...record } = records[index];
      let mealImage = null;
      if (mealImageFileId && bucket) {
        const file = await bucket.find({ _id: mealImageFileId }).next();
        if (file) {
          const chunks = [];
          for await (const chunk of bucket.openDownloadStream(mealImageFileId)) chunks.push(chunk);
          mealImage = { contentType: file.contentType, contentBase64: Buffer.concat(chunks).toString("base64") };
        }
      }
      await writeResponseChunk(res, JSON.stringify({ ...record, mealImage }));
    }
    await writeResponseChunk(res, `],"notifications":${JSON.stringify(notifications)},"supporterAccess":${JSON.stringify(supporterAccess)},"documents":[`);
    for (let index = 0; index < documents.length; index += 1) {
      const document = documents[index];
      if (index) await writeResponseChunk(res, ",");
      const chunks = [];
      if (bucket) {
        for await (const chunk of bucket.openDownloadStream(document.fileId)) chunks.push(chunk);
      }
      const { fileId, ...metadata } = document;
      await writeResponseChunk(res, JSON.stringify({ ...metadata, contentBase64: Buffer.concat(chunks).toString("base64") }));
    }
    const avatarFile = avatarFileId && bucket
      ? await bucket.find({ _id: avatarFileId }).next()
      : null;
    let avatar = null;
    if (avatarFile && bucket) {
      const chunks = [];
      for await (const chunk of bucket.openDownloadStream(avatarFileId)) chunks.push(chunk);
      avatar = { contentType: avatarFile.contentType, contentBase64: Buffer.concat(chunks).toString("base64") };
    }
    await writeResponseChunk(res, `],"profilePicture":${JSON.stringify(avatar)}}`);
    return res.end();
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    return next(error);
  }
});

authRouter.delete("/account", requireAuth, async (req, res, next) => {
  try {
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findById(req.userId).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(403).json({ message: "Your password didn't match. Your account has not been deleted." });
    const [documentFiles, mealImages] = await Promise.all([
      MedicalDocument.find({ owner: user._id }).select("fileId").lean(),
      Record.find({ owner: user._id, mealImageFileId: { $ne: null } }).select("mealImageFileId").lean(),
    ]);
    const files = [...documentFiles.map(({ fileId }) => fileId), ...mealImages.map(({ mealImageFileId }) => mealImageFileId), ...(user.avatarFileId ? [user.avatarFileId] : [])];
    if (files.length && mongoose.connection.db) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "herwellDocuments" });
      await Promise.all(files.map(async (fileId) => {
        try { await bucket.delete(fileId); }
        catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }));
    }
    await Promise.all([
      AuthToken.deleteMany({ user: user._id }),
      Record.deleteMany({ owner: user._id }),
      Record.updateMany({ sharedWith: user._id }, { $pull: { sharedWith: user._id } }),
      MedicalDocument.updateMany({ sharedWith: user._id }, { $pull: { sharedWith: user._id } }),
      Notification.deleteMany({ owner: user._id }),
      MedicalDocument.deleteMany({ owner: user._id }),
      SupporterAccess.deleteMany({ $or: [{ owner: user._id }, { supporter: user._id }] }),
      PushSubscription.deleteMany({ user: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
    res.clearCookie("herwell_session", { ...cookieOptions, maxAge: undefined });
    return res.json({ message: "Your account has been deleted." });
  } catch (error) { return next(error); }
});

recordsRouter.use(requireAuth);
recordsRouter.get("/", async (req, res, next) => {
  try {
    const filter = { owner: req.userId };
    if (req.query.category) {
      if (!recordCategories.includes(req.query.category)) return res.status(400).json({ message: "Choose a valid record category." });
      filter.category = req.query.category;
    }
    if (req.query.start || req.query.end) {
      if (!isValidDate(req.query.start) || !isValidDate(req.query.end)) return res.status(400).json({ message: "Choose valid calendar dates." });
      filter.scheduledAt = {};
      if (req.query.start) filter.scheduledAt.$gte = new Date(req.query.start);
      if (req.query.end) filter.scheduledAt.$lt = new Date(req.query.end);
    }
    const records = await Record.find(filter).populate("supporterUpdates.author", "name").sort({ scheduledAt: 1, createdAt: -1 }).limit(500).lean();
    return res.json({ records });
  } catch (error) { return next(error); }
});

recordsRouter.post("/", async (req, res, next) => {
  try {
    const { category, title, notes, scheduledAt } = req.body;
    const invalidCommonFields = !recordCategories.includes(category)
      || typeof title !== "string" || !title.trim() || title.trim().length > 120
      || (notes !== undefined && (typeof notes !== "string" || notes.length > 2000))
      || !isValidDate(scheduledAt)
      || !isValidDate(req.body.startsAt) || !isValidDate(req.body.endsAt)
      || !isValidDate(req.body.startDate) || !isValidDate(req.body.endDate)
      || !isValidDate(req.body.reminderAt)
      || !isValidRecurrence(req.body.recurrence)
      || (req.body.status !== undefined && !recordStatuses.includes(req.body.status))
      || (req.body.categoryLabel !== undefined && (typeof req.body.categoryLabel !== "string" || req.body.categoryLabel.trim().length > 60))
      || (req.body.reminderEnabled !== undefined && typeof req.body.reminderEnabled !== "boolean");
    const invalidMealFields = category === "meal"
      && ((req.body.mealType !== undefined && !mealTypes.includes(req.body.mealType))
        || (req.body.ingredients !== undefined && (typeof req.body.ingredients !== "string" || req.body.ingredients.length > 1200))
        || (req.body.preparation !== undefined && (typeof req.body.preparation !== "string" || req.body.preparation.length > 2000))
        || (req.body.vegetarian !== undefined && typeof req.body.vegetarian !== "boolean"));
    const invalidActivityFields = category === "activity"
      && ((req.body.activityType !== undefined && (typeof req.body.activityType !== "string" || req.body.activityType.trim().length > 80))
        || (req.body.durationMinutes !== undefined && (!Number.isInteger(req.body.durationMinutes) || req.body.durationMinutes < 1 || req.body.durationMinutes > 600)));
    const invalidWaterFields = category === "water"
      && (!Number.isInteger(req.body.amountMl) || req.body.amountMl < 1 || req.body.amountMl > 3000);
    const checkIn = req.body.checkIn;
    const invalidCheckIn = category === "checkin"
      && (!checkIn || typeof checkIn !== "object" || Array.isArray(checkIn)
        || (Object.keys(checkIn).length === 0 && !(typeof notes === "string" && notes.trim()))
        || Object.entries(checkIn).some(([key, value]) => !Object.hasOwn(checkInOptions, key) || !checkInOptions[key].includes(value)));
    const appointment = req.body.appointment;
    const invalidAppointment = category === "appointment"
      && (appointment !== undefined && (!appointment || typeof appointment !== "object" || Array.isArray(appointment)
        || Object.entries(appointment).some(([key, value]) => !["provider", "location", "purpose", "clinicianInstructions"].includes(key)
          || typeof value !== "string" || value.length > ({ provider: 120, location: 250, purpose: 300, clinicianInstructions: 2000 })[key])));
    const journal = req.body.journal;
    const invalidJournal = category === "journal"
      && (journal !== undefined && (!journal || typeof journal !== "object" || Array.isArray(journal)
        || (journal.mood !== undefined && !["low", "okay", "good"].includes(journal.mood))
        || (journal.tags !== undefined && (!Array.isArray(journal.tags) || journal.tags.length > 10 || journal.tags.some((tag) => typeof tag !== "string" || tag.trim().length < 1 || tag.trim().length > 30)))));
    const measurement = req.body.measurement;
    const invalidMeasurement = measurement !== undefined
      && (!measurement || typeof measurement !== "object" || Array.isArray(measurement)
        || typeof measurement.type !== "string" || measurement.type.trim().length > 40
        || typeof measurement.unit !== "string" || measurement.unit.trim().length > 20
        || typeof measurement.value !== "number" || !Number.isFinite(measurement.value) || measurement.value < 0 || measurement.value > 100000);
    const invalidLink = req.body.linkRecordId !== undefined
      && (typeof req.body.linkRecordId !== "string" || !mongoose.isValidObjectId(req.body.linkRecordId));
    if (invalidCommonFields || invalidMealFields || invalidActivityFields || invalidWaterFields || invalidCheckIn || invalidAppointment || invalidJournal || invalidMeasurement) {
      return res.status(400).json({ message: "Check the details and try again." });
    }
    if (invalidLink) return res.status(400).json({ message: "Choose a valid item to link." });
    if (req.body.linkRecordId) {
      const linkedRecord = await Record.findOne({ _id: req.body.linkRecordId, owner: req.userId }).select("_id");
      if (!linkedRecord) return res.status(400).json({ message: "The linked item must be in your private space." });
    }
    const record = await Record.create({
      owner: req.userId,
      category,
      title: title.trim(),
      notes: notes?.trim() || "",
      scheduledAt: scheduledAt || null,
      startsAt: req.body.startsAt || null,
      endsAt: req.body.endsAt || null,
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null,
      recurrence: req.body.recurrence || { frequency: "none", interval: 1 },
      categoryLabel: req.body.categoryLabel?.trim() || "",
      status: req.body.status || "planned",
      reminderAt: req.body.reminderAt || null,
      reminderEnabled: req.body.reminderEnabled || false,
      linkRecordId: req.body.linkRecordId || null,
      ...(category === "meal" && {
        mealType: req.body.mealType,
        ingredients: req.body.ingredients?.trim() || "",
        preparation: req.body.preparation?.trim() || "",
        vegetarian: req.body.vegetarian || false,
      }),
      ...(category === "activity" && {
        activityType: req.body.activityType?.trim() || "",
        durationMinutes: req.body.durationMinutes,
      }),
      ...(category === "water" && { amountMl: req.body.amountMl }),
      ...(category === "checkin" && { checkIn }),
      ...(category === "appointment" && { appointment: appointment || {} }),
      ...(category === "journal" && { journal: journal || {} }),
      ...(measurement && { measurement }),
    });
    if (record.reminderAt && record.reminderEnabled) {
      const occurrenceKey = record.recurrence?.startDateKey || record.reminderAt.toISOString().slice(0, 10);
      await Notification.findOneAndUpdate(
        { owner: req.userId, record: record._id, occurrenceKey },
        { $set: { title: record.title, scheduledAt: record.reminderAt, occurrenceAt: record.reminderAt, status: "pending", snoozedUntil: null, retryAt: null } },
        { upsert: true, new: true, runValidators: true },
      );
    }
    return res.status(201).json({ record });
  } catch (error) { return next(error); }
});

recordsRouter.patch("/:id", async (req, res, next) => {
  try {
    const updates = {};
    const unsets = {};
    if (typeof req.body.completed === "boolean") {
      updates.completed = req.body.completed;
      updates.status = req.body.completed ? "completed" : "planned";
    }
    if (req.body.status !== undefined) {
      if (!recordStatuses.includes(req.body.status)) return res.status(400).json({ message: "Choose a valid activity status." });
      updates.status = req.body.status;
      updates.completed = req.body.status === "completed";
    }
    for (const field of ["title", "notes", "categoryLabel", "ingredients", "preparation", "activityType"]) {
      if (req.body[field] === undefined) continue;
      const max = { title: 120, notes: 2000, categoryLabel: 60, ingredients: 1200, preparation: 2000, activityType: 80 }[field];
      if (typeof req.body[field] !== "string" || req.body[field].length > max || (field === "title" && !req.body[field].trim())) return res.status(400).json({ message: `Check the ${field} field and try again.` });
      updates[field] = field === "title" ? req.body[field].trim() : req.body[field].trim();
    }
    if (req.body.mealType !== undefined) {
      if (!mealTypes.includes(req.body.mealType)) return res.status(400).json({ message: "Choose a valid meal type." });
      updates.mealType = req.body.mealType;
    }
    if (req.body.vegetarian !== undefined) {
      if (typeof req.body.vegetarian !== "boolean") return res.status(400).json({ message: "Choose a valid food preference." });
      updates.vegetarian = req.body.vegetarian;
    }
    if (req.body.scheduledAt !== undefined) {
      if (!isValidDate(req.body.scheduledAt)) return res.status(400).json({ message: "Choose a valid schedule date." });
      updates.scheduledAt = req.body.scheduledAt || null;
    }
    if (req.body.reminderAt !== undefined) {
      if (!isValidDate(req.body.reminderAt)) return res.status(400).json({ message: "Choose a valid reminder date." });
      updates.reminderAt = req.body.reminderAt || null;
    }
    if (req.body.reminderEnabled !== undefined) {
      if (typeof req.body.reminderEnabled !== "boolean") return res.status(400).json({ message: "Choose whether reminders are enabled." });
      updates.reminderEnabled = req.body.reminderEnabled;
    }
    for (const field of ["startsAt", "endsAt", "startDate", "endDate"]) {
      if (req.body[field] === undefined) continue;
      if (!isValidDate(req.body[field])) return res.status(400).json({ message: `Choose a valid ${field} date.` });
      updates[field] = req.body[field] || null;
    }
    if (req.body.recurrence !== undefined) {
      if (!isValidRecurrence(req.body.recurrence)) return res.status(400).json({ message: "Check the repeat schedule." });
      updates.recurrence = req.body.recurrence;
    }
    if (req.body.appointment !== undefined) {
      if (!req.body.appointment || typeof req.body.appointment !== "object" || Array.isArray(req.body.appointment)
        || Object.entries(req.body.appointment).some(([key, value]) => !["provider", "location", "purpose", "clinicianInstructions"].includes(key)
          || typeof value !== "string" || value.length > ({ provider: 120, location: 250, purpose: 300, clinicianInstructions: 2000 })[key])) {
        return res.status(400).json({ message: "Check the appointment details." });
      }
      updates.appointment = req.body.appointment;
    }
    if (req.body.journal !== undefined) {
      const journal = req.body.journal;
      if (!journal || typeof journal !== "object" || Array.isArray(journal)
        || (journal.mood !== undefined && !["low", "okay", "good"].includes(journal.mood))
        || (journal.tags !== undefined && (!Array.isArray(journal.tags) || journal.tags.length > 10 || journal.tags.some((tag) => typeof tag !== "string" || tag.trim().length < 1 || tag.trim().length > 30)))) {
        return res.status(400).json({ message: "Check the journal tags and mood." });
      }
      updates.journal = journal;
    }
    if (req.body.checkIn !== undefined) {
      const checkIn = req.body.checkIn;
      if (!checkIn || typeof checkIn !== "object" || Array.isArray(checkIn)
        || Object.entries(checkIn).some(([key, value]) => !Object.hasOwn(checkInOptions, key) || !checkInOptions[key].includes(value))) {
        return res.status(400).json({ message: "Check the wellness check-in fields." });
      }
      updates.checkIn = checkIn;
    }
    if (req.body.durationMinutes !== undefined) {
      if (!Number.isInteger(req.body.durationMinutes) || req.body.durationMinutes < 1 || req.body.durationMinutes > 600) return res.status(400).json({ message: "Enter a movement duration between 1 and 600 minutes." });
      updates.durationMinutes = req.body.durationMinutes;
    }
    if (req.body.amountMl !== undefined) {
      if (!Number.isInteger(req.body.amountMl) || req.body.amountMl < 1 || req.body.amountMl > 3000) return res.status(400).json({ message: "Enter a water amount between 1 and 3000 ml." });
      updates.amountMl = req.body.amountMl;
    }
    if (req.body.measurement !== undefined) {
      const measurement = req.body.measurement;
      if (measurement === null) unsets.measurement = 1;
      else if (!measurement || typeof measurement !== "object" || Array.isArray(measurement)
        || typeof measurement.type !== "string" || measurement.type.trim().length < 1 || measurement.type.trim().length > 40
        || typeof measurement.unit !== "string" || measurement.unit.trim().length < 1 || measurement.unit.trim().length > 20
        || typeof measurement.value !== "number" || !Number.isFinite(measurement.value) || measurement.value < 0 || measurement.value > 100000) {
        return res.status(400).json({ message: "Check the measurement details." });
      } else updates.measurement = measurement;
    }
    if (req.body.linkRecordId !== undefined) {
      if (typeof req.body.linkRecordId !== "string" || !mongoose.isValidObjectId(req.body.linkRecordId)) return res.status(400).json({ message: "Choose a valid item to link." });
      const linkedRecord = await Record.findOne({ _id: req.body.linkRecordId, owner: req.userId }).select("_id");
      if (!linkedRecord) return res.status(400).json({ message: "The linked item must be in your private space." });
      updates.linkRecordId = linkedRecord._id;
    }
    if (!Object.keys(updates).length && !Object.keys(unsets).length) return res.status(400).json({ message: "There are no valid changes to save." });
    const update = { $set: updates };
    if (Object.keys(unsets).length) update.$unset = unsets;
    if (updates.status === "completed" || updates.status === "skipped" || req.body.scheduledAt !== undefined) {
      update.$push = { completionHistory: { status: req.body.scheduledAt !== undefined ? "rescheduled" : updates.status, at: new Date() } };
    }
    const record = await Record.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, update, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ message: "That item wasn't found in your space." });
    if (record.reminderAt && record.reminderEnabled) {
      const occurrenceKey = record.recurrence?.startDateKey || record.reminderAt.toISOString().slice(0, 10);
      await Notification.findOneAndUpdate(
        { owner: req.userId, record: record._id, status: { $in: ["pending", "snoozed"] } },
        { $set: { title: record.title, scheduledAt: record.reminderAt, occurrenceAt: record.reminderAt, occurrenceKey, status: "pending", snoozedUntil: null, retryAt: null } },
        { upsert: true, new: true, runValidators: true },
      );
    } else {
      await Notification.updateMany({ owner: req.userId, record: record._id, status: { $in: ["pending", "snoozed"] } }, { $set: { status: "dismissed" } });
    }
    return res.json({ record });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That item wasn't found in your space." });
    return next(error);
  }
});

recordsRouter.patch("/:id/occurrences", async (req, res, next) => {
  try {
    const { dateKey, status } = req.body;
    if (!isValidDateKey(dateKey) || !["completed", "skipped", "planned"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid occurrence date and status." });
    }
    const record = await Record.findOne({ _id: req.params.id, owner: req.userId });
    if (!record) return res.status(404).json({ message: "That item wasn't found in your space." });
    if (record.recurrence?.frequency === "none" || !isOccurrenceDate(record, dateKey)) {
      return res.status(400).json({ message: "That date is not a scheduled occurrence of this item." });
    }
    const occurrence = record.occurrences.find((item) => item.dateKey === dateKey);
    if (occurrence) {
      occurrence.status = status;
      occurrence.updatedAt = new Date();
    } else record.occurrences.push({ dateKey, status, updatedAt: new Date() });
    await record.save();
    return res.json({ record });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That item wasn't found in your space." });
    return next(error);
  }
});

recordsRouter.delete("/:id", async (req, res, next) => {
  try {
    const record = await Record.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!record) return res.status(404).json({ message: "That item wasn't found in your space." });
    await Notification.deleteMany({ owner: req.userId, record: record._id });
    if (record.mealImageFileId) {
      try { await getBucket().delete(record.mealImageFileId); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return res.json({ message: "Item removed." });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That item wasn't found in your space." });
    return next(error);
  }
});
