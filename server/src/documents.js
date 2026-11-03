import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { Readable } from "node:stream";
import { MedicalDocument, User, SupporterAccess, Record } from "./models.js";
import { requireAuth } from "./auth.js";

export const documentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const mealImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const allowedTypes = new Map([
  ["application/pdf", (buffer) => buffer.subarray(0, 5).toString() === "%PDF-"],
  ["image/png", (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
  ["image/jpeg", (buffer) => buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255],
  ["image/webp", (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP"],
]);
const documentCategories = ["report", "prescription", "test-result", "other"];

export function getBucket() {
  if (!mongoose.connection.db) throw new Error("Document storage is not available.");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "herwellDocuments" });
}

function safeFilename(filename) {
  return filename.replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(0, 180) || "private-document";
}

function canShareMime(contentType, buffer) {
  const checkSignature = allowedTypes.get(contentType);
  return Boolean(checkSignature && checkSignature(buffer));
}

function uploadBuffer(bucket, buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(filename, { contentType });
    Readable.from(buffer).pipe(stream).on("error", reject).on("finish", () => resolve(stream.id));
  });
}

documentsRouter.use(requireAuth);
documentsRouter.get("/", async (req, res, next) => {
  try {
    const documents = await MedicalDocument.find({ owner: req.userId }).sort({ documentDate: -1, createdAt: -1 }).select("-owner -__v").lean();
    return res.json({ documents });
  } catch (error) { return next(error); }
});

documentsRouter.get("/avatar", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("avatarFileId");
    if (!user?.avatarFileId) return res.status(404).json({ message: "No profile picture is set." });
    const file = await getBucket().find({ _id: user.avatarFileId }).next();
    if (!file) return res.status(404).json({ message: "No profile picture is set." });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", file.length);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return getBucket().openDownloadStream(user.avatarFileId).pipe(res);
  } catch (error) { return next(error); }
});

documentsRouter.post("/avatar", uploadAvatar);

documentsRouter.post("/meals/:id/image", (req, res, next) => {
  mealImageUpload.single("file")(req, res, async (uploadError) => {
    if (uploadError) return res.status(uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: "Choose an image smaller than 5 MB." });
    try {
      if (!req.file || req.file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype) || !canShareMime(req.file.mimetype, req.file.buffer)) {
        return res.status(400).json({ message: "Choose a JPEG, PNG, or WebP image smaller than 5 MB." });
      }
      const record = await Record.findOne({ _id: req.params.id, owner: req.userId, category: "meal" });
      if (!record) return res.status(404).json({ message: "That meal wasn't found in your private space." });
      const bucket = getBucket();
      const fileId = await uploadBuffer(bucket, req.file.buffer, `meal-${record.id}`, req.file.mimetype);
      const previousFileId = record.mealImageFileId;
      try {
        record.mealImageFileId = fileId;
        await record.save();
      } catch (error) {
        await bucket.delete(fileId);
        throw error;
      }
      if (previousFileId) await bucket.delete(previousFileId);
      return res.json({ message: "Meal image saved privately.", imageUrl: `/api/documents/meals/${record.id}/image` });
    } catch (error) {
      if (error.name === "CastError") return res.status(404).json({ message: "That meal wasn't found in your private space." });
      return next(error);
    }
  });
});

documentsRouter.get("/meals/:id/image", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "That meal image wasn't found." });
    const record = await Record.findOne({ _id: req.params.id, category: "meal", $or: [{ owner: req.userId }, { sharedWith: req.userId }] });
    if (!record?.mealImageFileId) return res.status(404).json({ message: "That meal image wasn't found." });
    if (!record.owner.equals(req.userId)) {
      const access = await SupporterAccess.findOne({ owner: record.owner, supporter: req.userId, status: "accepted", permissions: "meals" }).select("_id");
      if (!access) return res.status(404).json({ message: "That meal image wasn't found." });
    }
    const file = await getBucket().find({ _id: record.mealImageFileId }).next();
    if (!file) return res.status(404).json({ message: "That meal image wasn't found." });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", file.length);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return getBucket().openDownloadStream(record.mealImageFileId).pipe(res);
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That meal image wasn't found." });
    return next(error);
  }
});

documentsRouter.delete("/meals/:id/image", async (req, res, next) => {
  try {
    const record = await Record.findOne({ _id: req.params.id, owner: req.userId, category: "meal" });
    if (!record) return res.status(404).json({ message: "That meal wasn't found in your private space." });
    if (!record.mealImageFileId) return res.status(404).json({ message: "This meal has no image." });
    const fileId = record.mealImageFileId;
    record.mealImageFileId = null;
    await record.save();
    await getBucket().delete(fileId);
    return res.json({ message: "Meal image removed." });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "That meal wasn't found in your private space." });
    return next(error);
  }
});

documentsRouter.delete("/avatar", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("avatarFileId");
    if (!user?.avatarFileId) return res.status(404).json({ message: "No profile picture is set." });
    const fileId = user.avatarFileId;
    user.avatarFileId = null;
    await user.save();
    await getBucket().delete(fileId);
    return res.json({ message: "Profile picture removed." });
  } catch (error) { return next(error); }
});

documentsRouter.post("/", (req, res, next) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: uploadError.code === "LIMIT_FILE_SIZE" ? "Choose a file smaller than 10 MB." : "Choose one PDF, JPEG, or PNG file." });
    }
    try {
      const { title, description = "", category = "other", documentDate } = req.body;
      if (!req.file || typeof title !== "string" || !title.trim() || title.trim().length > 120
        || typeof description !== "string" || description.length > 1000
        || !documentCategories.includes(category)
        || (documentDate && Number.isNaN(Date.parse(documentDate)))
        || !canShareMime(req.file.mimetype, req.file.buffer)) {
        return res.status(400).json({ message: "Add a title and choose a valid PDF, JPEG, or PNG file smaller than 10 MB." });
      }
      const bucket = getBucket();
      const fileId = await uploadBuffer(bucket, req.file.buffer, safeFilename(req.file.originalname), req.file.mimetype);
      try {
        const document = await MedicalDocument.create({
          owner: req.userId,
          fileId,
          title: title.trim(),
          description: description.trim(),
          category,
          documentDate: documentDate || null,
          contentType: req.file.mimetype,
          filename: safeFilename(req.file.originalname),
          size: req.file.size,
        });
        const result = document.toObject();
        delete result.owner;
        return res.status(201).json({ document: result });
      } catch (error) {
        await bucket.delete(fileId);
        throw error;
      }
    } catch (error) { return next(error); }
  });
});

documentsRouter.get("/:id/file", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "That private document wasn't found." });
    const document = await MedicalDocument.findOne({
      _id: req.params.id,
      $or: [{ owner: req.userId }, { sharedWith: req.userId }],
    });
    if (!document) return res.status(404).json({ message: "That private document wasn't found." });
    if (!document.owner.equals(req.userId)) {
      const access = await SupporterAccess.findOne({
        owner: document.owner, supporter: req.userId, status: "accepted", permissions: "documents",
      }).select("_id");
      if (!access) return res.status(404).json({ message: "That private document wasn't found." });
    }
    const disposition = req.query.preview === "true" && document.contentType !== "application/pdf"
      ? "inline"
      : req.query.preview === "true" ? "inline" : "attachment";
    res.setHeader("Content-Type", document.contentType);
    res.setHeader("Content-Length", document.size);
    res.setHeader("Content-Disposition", `${disposition}; filename="${document.filename.replace(/["\r\n]/g, "_")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    const stream = getBucket().openDownloadStream(document.fileId);
    stream.on("error", (error) => {
      if (!res.headersSent) return next(error);
      res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) { return next(error); }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "That private document wasn't found." });
    const document = await MedicalDocument.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!document) return res.status(404).json({ message: "That private document wasn't found." });
    await getBucket().delete(document.fileId);
    return res.json({ message: "Private document deleted." });
  } catch (error) { return next(error); }
});

export async function uploadAvatar(req, res, next) {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) return res.status(uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: "Choose an image smaller than 5 MB." });
    try {
      if (!req.file || req.file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(req.file.mimetype) || !canShareMime(req.file.mimetype, req.file.buffer)) {
        return res.status(400).json({ message: "Choose a JPEG or PNG image smaller than 5 MB." });
      }
      const user = await User.findById(req.userId).select("avatarFileId");
      if (!user) return res.status(404).json({ message: "Account not found." });
      const bucket = getBucket();
      const fileId = await uploadBuffer(bucket, req.file.buffer, `avatar-${user.id}`, req.file.mimetype);
      const previousFileId = user.avatarFileId;
      try {
        user.avatarFileId = fileId;
        await user.save();
      } catch (error) {
        await bucket.delete(fileId);
        throw error;
      }
      if (previousFileId) await bucket.delete(previousFileId);
      return res.json({ message: "Profile picture updated." });
    } catch (error) { return next(error); }
  });
}
