import jwt from "jsonwebtoken";
import { User } from "./models.js";

export function createCookieOptions(isProduction = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "strict",
    secure: isProduction,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export const cookieOptions = createCookieOptions();

export async function requireAuth(req, res, next) {
  const token = req.cookies?.herwell_session;
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
  if (!req.cookies?.herwell_session) return next();
  return requireAuth(req, res, next);
}
