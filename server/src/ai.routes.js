import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./auth.js";
import { AiMessage } from "./models.js";
import { generateAiResponse } from "./ai.js";

export const aiRouter = Router();

// Rate limiter for AI chat generation to prevent abuse and protect Gemini API quota
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === "development" ? 30 : 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "You are sending messages too quickly. Please take a gentle pause and try again in a moment." },
});

aiRouter.use(requireAuth);

/**
 * POST /api/ai/chat
 * Send a message to HerWell AI and receive an authorized, safe response
 */
aiRouter.post("/chat", aiChatLimiter, async (req, res, next) => {
  try {
    const rawMessage = req.body?.message;
    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
      return res.status(400).json({ message: "Please enter a message before sending." });
    }

    const message = rawMessage.trim();
    if (message.length > 2000) {
      return res.status(400).json({ message: "Your message is too long. Please shorten it to under 2000 characters." });
    }

    const result = await generateAiResponse(req.userId, message);
    return res.json({
      reply: result.reply,
      createdAt: result.createdAt,
    });
  } catch (error) {
    if (error.code === "MISSING_API_KEY" || error.status === 503) {
      return res.status(503).json({ message: error.message });
    }
    if (error.status === 429) {
      return res.status(429).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
});

/**
 * GET /api/ai/history
 * Fetch the authenticated user's conversation history
 */
aiRouter.get("/history", async (req, res, next) => {
  try {
    const messages = await AiMessage.find({ user: req.userId })
      .sort({ createdAt: 1 })
      .limit(60)
      .select("role content createdAt")
      .lean();

    return res.json({
      messages: messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/ai/history
 * Clear the authenticated user's conversation history
 */
aiRouter.delete("/history", async (req, res, next) => {
  try {
    await AiMessage.deleteMany({ user: req.userId });
    return res.json({ message: "Chat history cleared successfully." });
  } catch (error) {
    return next(error);
  }
});

