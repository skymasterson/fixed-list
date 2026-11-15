# Fixed List

Rental maintenance coordination: a property manager sends jobs to contractors by magic link, tracks them,
and (in later build steps) handles tenant entry notices, Igloo codes, photos and invoices.

## Layout

| Path | What it is |
| --- | --- |
| `web/` | React + Vite + TypeScript PWA. Admin pages need Google sign-in; `/t/{token}` and `/c/{listToken}` are public contractor pages. |
| `functions/` | TypeScript Cloud Functions (2nd gen). All contractor reads and writes go through these. |
| `shared/` | Types and message wording used by both. |
| `firestore.rules` | Each property manager sees only their own data; the public has no direct access. |
| `e2e/smoke.mjs` | Browser test of the whole flow against the emulators. |

## Run locally

Needs Node 22 and Java (for the Firebase emulators).

```bash
npm run install:all
```

```bash
npm run emulators
```

In a second terminal, allow a sign-in email and start the app:

```bash
npm run seed -- you@example.com
```

```bash
npm run dev
```

## Test

```bash
npm test
```

With the emulators and dev server running, the browser test is:

```bash
npm run seed && node e2e/smoke.mjs
```

## Deploy

1. Put the Firebase web app config in `web/.env.production` (see `web/.env.example`).
2. Check the project ID in `.firebaserc`.
3. In the Firebase console, create the Firestore document `config/access` with an array field `pmEmails`
   listing the Google accounts allowed to sign in. Nobody can sign in until it exists.
4. Deploy:

```bash
npm run deploy
```

## Status

Done: project scaffold, Google sign-in with allow-list, units and contractors, task creation (urgent flag,
desired date, per-task overrun limit), manual send by copied link, contractor accept/decline with the 24-hour
entry rule, reassignment, My Jobs list.

Next, in PRD order: photo uploads, Twilio SMS, tenant notice email and push, overrun approval, completion and
invoice PDF, scheduled reminders, reporting.
