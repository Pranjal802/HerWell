import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { sendVerificationEmail } from "./email.js";

test("development verification prints the configured link without SMTP", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const log = mock.method(console, "info", () => {});
  const link = "https://herwell.example/?verifyEmail=one-time-token";
  try {
    await sendVerificationEmail({ to: "person@example.test", link });
    assert.equal(log.mock.calls.length, 1);
    assert.deepEqual(log.mock.calls[0].arguments, [`[DEV] Email verification link:\n${link}`]);
  } finally {
    log.mock.restore();
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test("non-development verification uses SMTP configuration", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSmtp = Object.fromEntries(
    ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]
      .map((key) => [key, process.env[key]]),
  );
  process.env.NODE_ENV = "production";
  for (const key of Object.keys(previousSmtp)) delete process.env[key];
  const log = mock.method(console, "info", () => {});
  try {
    await assert.rejects(
      sendVerificationEmail({ to: "person@example.test", link: "https://herwell.example/?verifyEmail=one-time-token" }),
      (error) => error.status === 503 && /Email delivery is not configured/.test(error.message),
    );
    assert.equal(log.mock.calls.length, 0);
  } finally {
    log.mock.restore();
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    for (const [key, value] of Object.entries(previousSmtp)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
