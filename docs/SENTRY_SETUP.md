# BillSutra Sentry Setup

This guide is tailored to the current BillSutra repo.

## 1. Create Sentry account and projects

1. Go to `https://sentry.io/signup/`.
2. Choose the free plan first. It is enough to validate setup in local, staging, and early production.
3. Create one organization for BillSutra.
4. Create these projects:
   - `billsutra-frontend`
   - `billsutra-backend`
   - `billsutra-worker` (optional but recommended when queues are enabled)

Why separate projects:
- frontend issues stay separate from backend API issues
- alerts stay cleaner
- release health and performance data are easier to read
- worker failures do not get mixed into customer-facing request crashes

## 2. What DSN means

DSN = the Sentry address your app sends events to.

- `NEXT_PUBLIC_SENTRY_DSN` is safe for the frontend
- `SENTRY_DSN` is for backend and worker
- `SENTRY_AUTH_TOKEN` is secret and must never go to the browser

## 3. What to copy from Sentry dashboard

From each project:
- DSN
- project slug
- organization slug

From organization settings:
- create an auth token for source map upload

Recommended source map token scopes:
- `project:read`
- `project:write`
- `release:admin`
- `org:read`

## 4. Where to paste env values

Frontend local: `front-end/.env.local`
Frontend staging: `front-end/.env.staging`
Frontend production: `front-end/.env.production`

Backend local: `server/.env.development`
Backend staging: `server/.env.staging`
Backend production: `server/.env.production`

### Frontend env

```env
NEXT_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/1111111
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
NEXT_PUBLIC_SENTRY_RELEASE=billsutra-frontend@local
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=1.0

SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/1111111
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=billsutra-frontend@local
SENTRY_TRACES_SAMPLE_RATE=1.0

SENTRY_AUTH_TOKEN=sntrys_your_secret_token
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=billsutra-frontend
```

### Backend env

```env
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/2222222
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=billsutra-backend@local
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_SLOW_REQUEST_THRESHOLD_MS=1200
```

### Worker env

The worker reuses the backend env loader, so normally it reads the same `server/.env.*` file.

If you want a dedicated worker project, set:

```env
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/3333333
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=billsutra-worker@1.0.0
```

## 5. Commands

You already have the SDKs installed in this repo.

If you ever need to install again:

```powershell
cd front-end
npm install @sentry/nextjs
```

```powershell
cd server
npm install @sentry/node
```

Build checks:

```powershell
cd server
npm run build
```

```powershell
cd front-end
npm run build
```

## 6. Files already wired in BillSutra

Frontend:
- `front-end/instrumentation.ts`
- `front-end/instrumentation-client.ts`
- `front-end/sentry.server.config.ts`
- `front-end/sentry.edge.config.ts`
- `front-end/next.config.mjs`
- `front-end/src/app/global-error.tsx`
- `front-end/src/lib/observability/sentry-options.ts`

Backend:
- `server/src/lib/observability.ts`
- `server/src/app.ts`
- `server/src/index.ts`
- `server/src/middlewares/error.middleware.ts`

Worker:
- `server/src/queues/worker.ts`

## 7. What BillSutra now captures

Frontend:
- app crashes
- route transition issues
- Next.js server/runtime request errors
- React global errors

Backend:
- route crashes
- Prisma failures that reach error middleware
- slow requests above `SENTRY_SLOW_REQUEST_THRESHOLD_MS`
- startup failures
- unhandled promise rejections
- uncaught exceptions

Worker:
- queue startup failures
- failed jobs
- unhandled promise rejections
- uncaught exceptions

## 8. Privacy and safety

BillSutra now redacts common sensitive fields before sending to Sentry:
- passwords
- tokens
- cookies
- authorization headers
- OTP values
- signatures
- client secrets

Still avoid manually attaching raw payment payloads or cookie blobs to custom Sentry events.

## 9. Recommended starter sampling

Local:
- frontend traces: `1.0`
- backend traces: `1.0`

Staging:
- frontend traces: `0.2`
- backend traces: `0.2`

Production:
- frontend traces: `0.1`
- backend traces: `0.1`

Reason:
- enough visibility without burning the free plan too quickly
- easy to raise temporarily during incident debugging

## 10. Safe test steps

### Frontend test

Open browser devtools console on the frontend and run:

```js
throw new Error("BillSutra frontend Sentry test");
```

Expected:
- error appears in `billsutra-frontend`

### Backend test

Temporarily add this inside any protected controller while testing locally:

```ts
throw new Error("BillSutra backend Sentry test");
```

Expected:
- error appears in `billsutra-backend`

### Worker test

Temporarily throw inside one worker processor or force one queue job to fail.

Expected:
- failure appears in `billsutra-worker`

## 11. Recommended alerts

In Sentry project settings:
- enable email alerts for new issues
- enable regression alerts
- enable spike alerts for repeated failures

Best first alerts for BillSutra:
- invoice send failures
- auth/login failures spike
- payment webhook failures
- worker job failures spike
- dashboard/analytics crash regressions
- export failures
- Redis connectivity crashes

## 12. Source maps

Frontend source maps are best uploaded only in CI or production builds.

Required env:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Do not commit `SENTRY_AUTH_TOKEN`.

## 13. Common mistakes to avoid

- putting `SENTRY_AUTH_TOKEN` in `NEXT_PUBLIC_*`
- using one single project for frontend, backend, and worker
- leaving production trace sample rate at `1.0`
- testing only in local and not checking staging events
- forgetting to set `SENTRY_RELEASE`
- exposing `.map` files publicly without thinking through source exposure

## 14. Official docs

- Next.js options: `https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/environments/`
- Express tracing: `https://docs.sentry.io/platforms/javascript/guides/express/tracing/`
- Node automatic instrumentation: `https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/automatic-instrumentation/`
- Queue instrumentation: `https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/custom-instrumentation/queues-module/`
- Auth token guide: `https://docs.sentry.io/api/guides/create-auth-token/`
