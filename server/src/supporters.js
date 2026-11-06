import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { User, Record, MedicalDocument, SupporterAccess } from "./models.js";
import { requireAuth } from "./auth.js";
import { appOrigin } from "./config.js";
import { sendAccountEmail } from "./email.js";
import { isOccurrenceDate, isValidDateKey } from "./recurrence.js";
import { getExistingInvitationState } from "./supporterInvitations.js";

export const supportersRouter = Router();
supportersRouter.use(requireAuth);

const availablePermissions = ["routines", "meals", "reminders", "appointments", "followups", "notes", "documents"];
const permissionForCategory = {
  routine: "routines",
  meal: "meals",
  reminder: "reminders",
  appointment: "appointments",
  followup: "followups",
  journal: "notes",
};
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

supportersRouter.get("/", async (req, res, next) => {
  try {
    const supporters = await SupporterAccess.find({ owner: req.userId }).populate("supporter", "name email").select("-inviteTokenHash").lean();
    return res.json({ supporters });
  } catch (error) { return next(error); }
});

supportersRouter.post("/invite", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions)] : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !permissions.length || permissions.some((permission) => !availablePermissions.includes(permission))) {
      return res.status(400).json({ message: "Add a valid email address and choose at least one section to share." });
    }
    const owner = await User.findById(req.userId).select("name email");
    if (email === owner.email) return res.status(400).json({ message: "Choose a different email address for your supporter." });
    const existing = await SupporterAccess.findOne({ owner: req.userId, email, status: { $in: ["pending", "accepted"] } });
    const existingState = getExistingInvitationState(existing);
    if (existingState === "accepted") {
      return res.status(409).json({ message: "This person has already accepted your invitation. They should sign in with this email; you can share records from the Supporter access page." });
    }
    if (existingState === "pending") {
      return res.status(409).json({ message: "An invitation is already pending for this email. Ask them to sign in with this exact email and open More > Supporter access." });
    }
    const inviteToken = randomBytes(32).toString("base64url");
    const previousInvitation = existingState === "expired"
      ? {
        permissions: [...existing.permissions],
        inviteTokenHash: existing.inviteTokenHash,
        inviteExpiresAt: existing.inviteExpiresAt,
        history: existing.history.map(({ action, at }) => ({ action, at })),
      }
      : null;
    const supporter = existingState === "expired"
      ? existing
      : new SupporterAccess({ owner: req.userId, email });
    supporter.permissions = permissions;
    supporter.inviteTokenHash = hashToken(inviteToken);
    supporter.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    supporter.history.push({ action: existingState === "expired" ? "reinvited" : "invited" });
    await supporter.save();
    const link = new URL("/", appOrigin);
    link.searchParams.set("acceptInvite", inviteToken);
    try {
      await sendAccountEmail({
        to: email,
        subject: "A private HerWell invitation",
        text: `${owner.name} invited you to view selected HerWell information. Your invitation expires in seven days.\n\nReview and accept the invitation after signing in:\n${link}`,
      });
    } catch (error) {
      if (previousInvitation) {
        supporter.permissions = previousInvitation.permissions;
        supporter.inviteTokenHash = previousInvitation.inviteTokenHash;
        supporter.inviteExpiresAt = previousInvitation.inviteExpiresAt;
        supporter.history = previousInvitation.history;
        await supporter.save();
      } else {
        await SupporterAccess.deleteOne({ _id: supporter._id });
      }
      return next(error);
    }
    return res.status(201).json({
      message: existingState === "expired"
        ? "The expired invitation was renewed and a new link was sent. Ask them to sign in with this email."
        : "Invitation sent. You can update or revoke it at any time.",
    });
  } catch (error) { return next(error); }
});

supportersRouter.get("/invitations", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("email");
    const invitations = await SupporterAccess.find({ email: user.email, status: "pending", inviteExpiresAt: { $gt: new Date() } })
      .populate("owner", "name").select("-inviteTokenHash").lean();
    return res.json({ invitations });
  } catch (error) { return next(error); }
});

supportersRouter.post("/invitations/accept", async (req, res, next) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token : "";
    const user = await User.findById(req.userId).select("email");
    const filter = {
      email: user.email,
      status: "pending",
      inviteExpiresAt: { $gt: new Date() },
    };
    if (token) filter.inviteTokenHash = hashToken(token);
    else if (typeof req.body.invitationId === "string") filter._id = req.body.invitationId;
    else return res.status(400).json({ message: "Choose an invitation to accept." });
    const invitation = await SupporterAccess.findOne(filter);
    if (!invitation) return res.status(400).json({ message: "This invitation is invalid or has expired." });
    invitation.supporter = user._id;
    invitation.status = "accepted";
    invitation.inviteTokenHash = null;
    invitation.inviteExpiresAt = null;
    invitation.history.push({ action: "accepted" });
    await invitation.save();
    return res.json({ message: "Invitation accepted. You can only see information the owner shares with you." });
  } catch (error) { return next(error); }
});

supportersRouter.post("/invitations/reject", async (req, res, next) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token : "";
    const user = await User.findById(req.userId).select("email");
    const filter = {
      email: user.email,
      status: "pending",
      inviteExpiresAt: { $gt: new Date() },
    };
    if (token) filter.inviteTokenHash = hashToken(token);
    else if (typeof req.body.invitationId === "string") filter._id = req.body.invitationId;
    else return res.status(400).json({ message: "Choose an invitation to decline." });
    const invitation = await SupporterAccess.findOne(filter);
    if (!invitation) return res.status(400).json({ message: "This invitation is invalid or has expired." });
    invitation.status = "rejected";
    invitation.inviteTokenHash = null;
    invitation.history.push({ action: "rejected" });
    await invitation.save();
    return res.json({ message: "Invitation declined." });
  } catch (error) { return next(error); }
});

supportersRouter.patch("/:id", async (req, res, next) => {
  try {
    const permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions)] : null;
    if (!permissions?.length || permissions.some((permission) => !availablePermissions.includes(permission))) {
      return res.status(400).json({ message: "Choose at least one valid section to share." });
    }
    const access = await SupporterAccess.findOne({ _id: req.params.id, owner: req.userId, status: "accepted" });
    if (!access) return res.status(404).json({ message: "That active supporter wasn't found." });
    access.permissions = permissions;
    access.history.push({ action: "permissions-updated" });
    await access.save();
    const visibleCategories = Object.entries(permissionForCategory).filter(([, permission]) => permissions.includes(permission)).map(([category]) => category);
    await Record.updateMany(
      { owner: req.userId, sharedWith: access.supporter, category: { $nin: visibleCategories } },
      { $pull: { sharedWith: access.supporter } },
    );
    if (!permissions.includes("documents")) await MedicalDocument.updateMany({ owner: req.userId, sharedWith: access.supporter }, { $pull: { sharedWith: access.supporter } });
    return res.json({ supporter: { id: access.id, permissions: access.permissions } });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That supporter wasn't found." });
    return next(error);
  }
});

supportersRouter.post("/:id/revoke", async (req, res, next) => {
  try {
    const access = await SupporterAccess.findOne({ _id: req.params.id, owner: req.userId, status: { $in: ["pending", "accepted"] } });
    if (!access) return res.status(404).json({ message: "That active invitation wasn't found." });
    access.status = "revoked";
    access.inviteTokenHash = null;
    access.inviteExpiresAt = null;
    access.history.push({ action: "revoked" });
    await access.save();
    if (access.supporter) await Promise.all([
      Record.updateMany({ owner: req.userId, sharedWith: access.supporter }, { $pull: { sharedWith: access.supporter } }),
      MedicalDocument.updateMany({ owner: req.userId, sharedWith: access.supporter }, { $pull: { sharedWith: access.supporter } }),
    ]);
    return res.json({ message: "Access has been revoked." });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That supporter wasn't found." });
    return next(error);
  }
});

supportersRouter.post("/records/:id/share", async (req, res, next) => {
  try {
    const supporterId = req.body.supporterId;
    const share = req.body.share;
    if (typeof share !== "boolean" || typeof supporterId !== "string") return res.status(400).json({ message: "Choose a supporter and whether to share this item." });
    const record = await Record.findOne({ _id: req.params.id, owner: req.userId });
    if (!record) return res.status(404).json({ message: "That item wasn't found in your space." });
    const permission = permissionForCategory[record.category];
    if (!permission) return res.status(400).json({ message: "This kind of private record cannot be shared." });
    const access = await SupporterAccess.findOne({ _id: supporterId, owner: req.userId, status: "accepted", permissions: permission });
    if (!access?.supporter) return res.status(403).json({ message: "This supporter doesn't have permission to view this section." });
    if (share && !record.sharedWith.some((id) => id.equals(access.supporter))) record.sharedWith.push(access.supporter);
    if (!share) record.sharedWith = record.sharedWith.filter((id) => !id.equals(access.supporter));
    await record.save();
    access.history.push({ action: share ? `shared:${record.id}` : `unshared:${record.id}` });
    await access.save();
    return res.json({ message: share ? "Shared with your supporter." : "Sharing stopped." });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That item or supporter wasn't found." });
    return next(error);
  }
});

supportersRouter.post("/documents/:id/share", async (req, res, next) => {
  try {
    const supporterId = req.body.supporterId;
    const share = req.body.share;
    if (typeof share !== "boolean" || typeof supporterId !== "string") return res.status(400).json({ message: "Choose a supporter and whether to share this document." });
    const document = await MedicalDocument.findOne({ _id: req.params.id, owner: req.userId });
    if (!document) return res.status(404).json({ message: "That private document wasn't found." });
    const access = await SupporterAccess.findOne({ _id: supporterId, owner: req.userId, status: "accepted", permissions: "documents" });
    if (!access?.supporter) return res.status(403).json({ message: "This supporter doesn't have permission to view documents." });
    if (share && !document.sharedWith.some((id) => id.equals(access.supporter))) document.sharedWith.push(access.supporter);
    if (!share) document.sharedWith = document.sharedWith.filter((id) => !id.equals(access.supporter));
    await document.save();
    access.history.push({ action: share ? `shared-document:${document.id}` : `unshared-document:${document.id}` });
    await access.save();
    return res.json({ message: share ? "Document shared with your supporter." : "Document sharing stopped." });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That document or supporter wasn't found." });
    return next(error);
  }
});

supportersRouter.get("/shared/records", async (req, res, next) => {
  try {
    const accessList = await SupporterAccess.find({ supporter: req.userId, status: "accepted" }).lean();
    const allowed = accessList.flatMap((access) => Object.entries(permissionForCategory)
      .filter(([, permission]) => access.permissions.includes(permission))
      .map(([category]) => ({ owner: access.owner, category })));
    if (!allowed.length) return res.json({ records: [] });
    const records = await Record.find({ sharedWith: req.userId, $or: allowed }).populate("supporterUpdates.author", "name").sort({ scheduledAt: 1, createdAt: -1 }).lean();
    const owners = await User.find({ _id: { $in: accessList.map((access) => access.owner) } }).select("name").lean();
    const ownerNames = new Map(owners.map((owner) => [owner._id.toString(), owner.name]));
    const recordsWithPermissions = records.map((record) => ({
      ...record,
      sharedBy: ownerNames.get(record.owner.toString()) || "Supporter",
      canAddNote: accessList.some((access) => access.owner.equals(record.owner) && access.permissions.includes("notes")),
    }));
    return res.json({ records: recordsWithPermissions });
  } catch (error) { return next(error); }
});

supportersRouter.get("/shared/documents", async (req, res, next) => {
  try {
    const ownerIds = await SupporterAccess.find({ supporter: req.userId, status: "accepted", permissions: "documents" }).distinct("owner");
    const documents = await MedicalDocument.find({ owner: { $in: ownerIds }, sharedWith: req.userId })
      .select("-fileId -sharedWith -__v").populate("owner", "name").sort({ documentDate: -1 }).lean();
    return res.json({ documents: documents.map(({ owner, ...document }) => ({
      ...document,
      sharedBy: owner?.name || "Supporter",
    })) });
  } catch (error) { return next(error); }
});

supportersRouter.patch("/shared/records/:id", async (req, res, next) => {
  try {
    const hasCompletion = typeof req.body.completed === "boolean";
    const hasNote = req.body.note !== undefined;
    const occurrenceKey = req.body.occurrenceKey;
    if (!hasCompletion && !hasNote) return res.status(400).json({ message: "Add a note or update a shared routine." });
    if (hasNote && (typeof req.body.note !== "string" || !req.body.note.trim() || req.body.note.trim().length > 1000)) {
      return res.status(400).json({ message: "Write a note between 1 and 1000 characters." });
    }
    const permissions = hasNote ? ["notes"] : [];
    if (hasCompletion) permissions.push("routines");
    const accessList = await SupporterAccess.find({ supporter: req.userId, status: "accepted", permissions: { $all: permissions } }).select("owner permissions").lean();
    const owners = accessList.map((access) => access.owner);
    const filter = { _id: req.params.id, owner: { $in: owners }, sharedWith: req.userId };
    if (hasCompletion) filter.category = "routine";
    const record = await Record.findOne(filter);
    if (!record) return res.status(404).json({ message: "That shared item wasn't found or you don't have permission to update it." });
    if (hasCompletion && record.recurrence?.frequency !== "none" && occurrenceKey === undefined) {
      return res.status(400).json({ message: "Choose the date of the routine occurrence to update." });
    }
    if (hasCompletion && occurrenceKey !== undefined) {
      if (!isValidDateKey(occurrenceKey) || record.recurrence?.frequency === "none" || !isOccurrenceDate(record, occurrenceKey)) {
        return res.status(400).json({ message: "Choose a scheduled occurrence of this routine." });
      }
      const occurrence = record.occurrences.find((item) => item.dateKey === occurrenceKey);
      if (occurrence) {
        occurrence.status = req.body.completed ? "completed" : "planned";
        occurrence.updatedAt = new Date();
      } else record.occurrences.push({ dateKey: occurrenceKey, status: req.body.completed ? "completed" : "planned" });
    } else if (hasCompletion) {
      record.completed = req.body.completed;
      record.status = req.body.completed ? "completed" : "planned";
    }
    if (hasNote) record.supporterUpdates.push({ author: req.userId, note: req.body.note.trim() });
    await record.save();
    await record.populate("supporterUpdates.author", "name");
    if (hasNote) {
      await SupporterAccess.updateOne(
        { owner: record.owner, supporter: req.userId, status: "accepted", permissions: "notes" },
        { $push: { history: { action: `note-added:${record.id}` } } },
      );
    }
    return res.json({ record });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That shared routine wasn't found." });
    return next(error);
  }
});
