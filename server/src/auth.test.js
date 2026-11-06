import assert from "node:assert/strict";
import { test } from "node:test";
import { createCookieOptions } from "./auth.js";
import { getAppOrigin } from "./config.js";
import { createOriginGuard } from "./originGuard.js";

test("production session cookies support the cross-origin client securely", () => {
  const options = createCookieOptions({ NODE_ENV: "production" });
  assert.equal(options.sameSite, "none");
  assert.equal(options.secure, true);
  assert.equal(options.httpOnly, true);
});

test("Railway production cookies stay secure even when NODE_ENV is development", () => {
  const options = createCookieOptions({ NODE_ENV: "development", RAILWAY_PUBLIC_DOMAIN: "herwell-production.up.railway.app" });
  assert.equal(options.sameSite, "none");
  assert.equal(options.secure, true);
});

test("development session cookies remain same-site and non-secure", () => {
  const options = createCookieOptions({ NODE_ENV: "development", APP_ORIGIN: "http://localhost:5173" });
  assert.equal(options.sameSite, "lax");
  assert.equal(options.secure, false);
});

test("Railway defaults the allowed client origin to the production Vercel app", () => {
  assert.equal(
    getAppOrigin({ NODE_ENV: "development", RAILWAY_PUBLIC_DOMAIN: "herwell-production.up.railway.app" }),
    "https://her-well-snowy.vercel.app",
  );
});

test("origin guard permits credentialed requests from the configured client", () => {
  const headers = {};
  let continued = false;
  const req = { get: () => "https://her-well-snowy.vercel.app", method: "POST" };
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    vary: (value) => { headers.Vary = value; },
    status() { return this; },
    json() { throw new Error("Allowed origin should continue."); },
  };

  createOriginGuard("https://her-well-snowy.vercel.app")(req, res, () => { continued = true; });

  assert.equal(continued, true);
  assert.equal(headers["Access-Control-Allow-Origin"], "https://her-well-snowy.vercel.app");
  assert.equal(headers["Access-Control-Allow-Credentials"], "true");
});

test("origin guard answers preflight requests for the configured client", () => {
  const headers = {};
  let status;
  const req = { get: () => "https://her-well-snowy.vercel.app", method: "OPTIONS" };
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    vary: (value) => { headers.Vary = value; },
    sendStatus(code) { status = code; },
  };

  createOriginGuard("https://her-well-snowy.vercel.app")(req, res, () => {
    throw new Error("Preflight should be handled.");
  });

  assert.equal(status, 204);
  assert.equal(headers["Access-Control-Allow-Methods"], "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
});

test("origin guard rejects cross-origin state-changing requests", () => {
  let status;
  let message;
  const req = { get: () => "https://attacker.example", method: "POST" };
  const res = {
    setHeader() {},
    vary() {},
    status(code) { status = code; return this; },
    json(body) { message = body.message; },
  };

  createOriginGuard("https://her-well-snowy.vercel.app")(req, res, () => {
    throw new Error("Disallowed origin should be rejected.");
  });

  assert.equal(status, 403);
  assert.equal(message, "This origin is not allowed.");
});
