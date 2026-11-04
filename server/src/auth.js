import jwt from "jsonwebtoken";
import { User } from "./models.js";

const isCrossSite = process.env.COOKIE_SAMESITE === "none" || process.env.NODE_ENV === "production" || (process.env.APP_ORIGIN && !process.env.APP_ORIGIN.includes("localhost"));

export const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.COOKIE_SAMESITE || (isCrossSite ? "none" : "lax"),
  secure: isCrossSite || process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return req.cookies?.herwell_session || null;
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Please sign in to continue." });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
  try {
    const user = await User.findById(payload.sub).select("emailVerifiedAt tokenVersion");
    if (!user || !user.emailVerifiedAt || (payload.ver !== (user.tokenVersion || 0))) {
      return res.status(401).json({ message: "Your session has expired. Please sign in again." });
    }
    req.userId = payload.sub;
    return next();
  } catch (error) { return next(error); }
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  return requireAuth(req, res, next);
}
