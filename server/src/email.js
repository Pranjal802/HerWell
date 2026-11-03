import nodemailer from "nodemailer";

export async function sendVerificationEmail({ to, link }) {
  const text = `Use this link to verify your email address. It expires in one hour:\n\n${link}\n\nIf you did not request this, you can ignore this message.`;
  if (process.env.NODE_ENV === "development") {
    console.info(`[DEV] Email verification link:\n${link}`);
    return;
  }
  await sendAccountEmail({ to, subject: "Verify your HerWell email", text });
}

export async function sendAccountEmail({ to, subject, text }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    const error = new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.");
    error.status = 503;
    throw error;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text });
  } catch (error) {
    const response = typeof error.response === "string" ? error.response : "";
    const testingRecipientBlocked = Number(error.responseCode) === 550 && /only send testing emails/i.test(response);
    const failure = new Error(
      testingRecipientBlocked
        ? "Your email provider is in testing mode and only allows delivery to its verified test recipient. Verify a sending domain in Resend and use an address on that domain in SMTP_FROM, or register using the allowed test recipient."
        : error.code === "EAUTH" || Number(error.responseCode) === 535
          ? "Your email provider rejected the SMTP credentials. Check SMTP_USER and SMTP_PASSWORD in server/.env."
          : "Email delivery is unavailable. Check your SMTP settings and try again.",
    );
    failure.status = 503;
    throw failure;
  }
}
