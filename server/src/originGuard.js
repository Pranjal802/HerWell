const allowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const allowedHeaders = "Content-Type, Authorization";
const safeMethods = new Set(["GET", "HEAD"]);

export function createOriginGuard(allowedOrigin) {
  return (req, res, next) => {
    const origin = req.get("Origin");
    const isAllowedOrigin = origin === allowedOrigin;

    if (isAllowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", allowedMethods);
      res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
      res.vary("Origin");
    }

    if (req.method === "OPTIONS") {
      if (!isAllowedOrigin) return res.status(403).json({ message: "This origin is not allowed." });
      return res.sendStatus(204);
    }

    if (origin && !isAllowedOrigin && !safeMethods.has(req.method)) {
      return res.status(403).json({ message: "This origin is not allowed." });
    }

    return next();
  };
}
