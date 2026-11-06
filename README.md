# HerWell

HerWell is a private, supportive MERN-stack wellness organiser. The app uses a responsive React/Vite client styled with Tailwind CSS, an Express API, and MongoDB.

## Get started

Requirements: Node.js 20+, npm, a MongoDB database, and SMTP credentials for account verification and password recovery.

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI` to your MongoDB connection string and set `JWT_SECRET` to a unique random value of at least 32 characters.
3. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Set `APP_ORIGIN` to the client origin users should use. In development, verification links are printed in the backend terminal and can be opened manually. In production, verification emails are sent through SMTP. Resend's unverified testing mode only permits sending to its verified test recipient; verify a sending domain and use an address on that domain in `SMTP_FROM` to deliver verification emails to other users.
4. To enable background browser push, generate an application-server key pair with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `server/.env`. Without valid VAPID settings, reminders still appear in the app while it is open and the API starts with background push disabled.
5. From the project root, run `npm install`, then `npm run dev`.
6. Open the Vite URL shown in the terminal.

The client runs on port 5173 and proxies `/api` requests to the Express API on port 5000. Production builds use the Vercel `/api` rewrite so browser requests stay on the client origin, even if a direct API URL is configured in the hosting dashboard. Set the server's `APP_ORIGIN` to the exact public client origin; Railway deployments default to `https://her-well-snowy.vercel.app` even if `NODE_ENV` is misconfigured. The API allows credentialed requests only from that origin and rejects cross-origin state-changing requests. Railway production sessions use secure cookies.

## Privacy and scope

Accounts require email verification. Password reset and verification links are one-time, hashed at rest, and expire. Sessions use HTTP-only, same-site cookies and are invalidated on password change/logout. Passwords are hashed with bcrypt.

Medical documents and profile photos are stored in MongoDB GridFS. Uploads are size/type checked, private by default, and served only after owner or explicit active-supporter access checks. Owner records are queried within the authenticated owner's scope. Supporters require an emailed invitation, verified account, an owner-selected section permission, and per-record sharing. Revocation removes access before cleanup. Wellness check-ins, journal entries, and documents are not automatically shared.

## Functionality in this build

- Separate Tailwind-styled dashboard, planner, meal planner, reminders, wellness, healthcare, documents, journal, calendar, supporter, and settings pages.
- Profile/preferences, avatar upload, email verification, password recovery/change, secure logout, JSON export (including uploaded file contents), and password-confirmed account deletion.
- Routine categories, date/time range, recurrence, skip/completion history, meal slots/ingredients/preferences, appointment details/follow-ups, journal tags/mood, reminders/snooze/dismiss, and calendar views.
- Optional water/movement logs and self-reported wellness observations/measurements. The app does not diagnose, interpret trends, prescribe diets or medication, or set activity/hydration targets.
- Supporter invitations, selectable section permissions, per-record/document sharing, permission-gated updates to shared records, audit history, and immediate revocation. Journal entries remain private unless the owner explicitly shares them.
- PDF/JPEG/PNG document upload, search/filter, preview, download, delete, and private storage.
- Private JPEG/PNG/WebP meal photos in GridFS, included in data export and removed with their meal or account.
- Email changes require the current password and confirmation at the new address. Confirmation invalidates active sessions.
- Spanish is available for primary navigation, authentication, settings, page headings, and common planner controls; English remains the default.
- Per-date completion and skip history for recurring routines, with date-specific controls in the calendar and planner.
- Installable PWA manifest and service worker. VAPID-configured Web Push sends scheduled reminders while the site is closed, with database-backed retry and quiet-hours handling.

The API scheduler checks for due reminders every 15 seconds while the server is running. Push delivery also depends on VAPID configuration, an active device subscription, and the browser/device push service; it is best-effort, not an emergency or guaranteed delivery channel. Recurring reminder delivery advances to the next scheduled occurrence after a successful delivery, using the owner's time zone across daylight-saving changes. The Spanish translation covers the main flows; user-entered content and some secondary explanatory text remain in its original language. The service worker supports push but does not cache private data for offline use.

HerWell is an organiser, not a medical adviser. Do not use it for urgent medical information. Before production use, complete a security, privacy, accessibility, and legal review and configure encrypted backups, retention, and deletion policies appropriate to the deployment.
