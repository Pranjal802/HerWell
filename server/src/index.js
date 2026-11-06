import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { authRouter, recordsRouter } from "./routes.js";
import { documentsRouter } from "./documents.js";
import { supportersRouter } from "./supporters.js";
import { notificationsRouter, startNotificationScheduler } from "./notifications.js";
import { appOrigin } from "./config.js";
import { createOriginGuard } from "./originGuard.js";
import { aiRouter } from "./ai.routes.js";

const requiredEnv = ["MONGODB_URI", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(helmet());
app.use(createOriginGuard(new URL(appOrigin).origin));
app.use(express.json({ limit: "16kb", type: (req) => req.path !== "/api/records/import" }));
app.use("/api/records/import", express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "development" ? 100 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => req.path === "/me",
}));
app.use("/api/auth", authRouter);
app.use("/api/records", recordsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/supporters", supportersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/ai", aiRouter);
app.get("/api/health", (_req, res) => res.json({ status: mongoose.connection.readyState === 1 ? "ok" : "starting" }));
app.use((error, _req, res, _next) => {
  console.error("Request failed:", error.message);
  if (error.name === "ValidationError") return res.status(400).json({ message: "Some information couldn't be saved. Please check your entries." });
  if (error.status === 503) return res.status(503).json({ message: error.message });
  const status = Number(error.status || error.statusCode);
  if (status >= 400 && status < 500) return res.status(status).json({ message: "Please check your request and try again." });
  return res.status(500).json({ message: "Something went wrong. Please try again." });
});

const port = Number(process.env.PORT) || 5000;
try {
  await mongoose.connect(process.env.MONGODB_URI);
  startNotificationScheduler();
  app.listen(port, "0.0.0.0", () => console.log(`HerWell API listening on port ${port}`));
} catch (error) {
  console.error("Could not connect to MongoDB:", error.message);
  process.exit(1);
}
