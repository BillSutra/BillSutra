# Observability

This app now includes:

- Sentry for error tracking and performance monitoring
- PostHog for product analytics

## Required Features (Baseline)

- Error and performance tracking on both frontend and backend
- Privacy-safe telemetry with redaction for sensitive fields
- Request-level correlation to support root-cause analysis
- Product event instrumentation for critical user journeys
- Configurable alerting for incidents and abnormal performance patterns

## Updated Features (April 2026)

- Added richer auth and billing journey analytics coverage
- Strengthened request and query context capture for debugging failed operations
- Improved guidance for telemetry opt-out defaults and privacy-safe event design
- Expanded operational recommendations for Sentry and PostHog funnels

## Environment Variables

Backend (`server/.env`)

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_SLOW_REQUEST_THRESHOLD_MS`
- `SENTRY_RELEASE`

Frontend (`front-end/.env.local`)

- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
- `NEXT_PUBLIC_SENTRY_RELEASE`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_ANALYTICS_OPT_OUT_DEFAULT`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_RELEASE`

## What Is Captured

### Errors

- Unhandled frontend runtime errors through Next.js + Sentry
- Unhandled backend exceptions through Express error middleware
- Critical backend payment flow failures in `PaymentsController.store`
- Frontend API failures from the shared Axios client
- React Query query and mutation failures from the shared query client

Attached metadata:

- authenticated user ID and role when available
- environment and request path
- safe request/query/body payloads
- request IDs on backend responses
- mutation/query keys for React Query failures

Sensitive fields such as passwords, auth tokens, cookies, OTP codes, and transaction identifiers are redacted before capture.

### Performance

- Sentry tracing is enabled on frontend and backend
- backend requests over `SENTRY_SLOW_REQUEST_THRESHOLD_MS` are reported as slow-request warnings

### Product Analytics

Tracked events currently include:

- `auth_signup_started`
- `auth_signup_succeeded`
- `auth_signup_failed`
- `auth_login_started`
- `auth_login_succeeded`
- `auth_login_failed`
- `auth_login_otp_requested`
- `auth_login_otp_sent`
- `auth_login_otp_failed`
- `auth_logout`
- `purchase_suggestion_prefilled`
- `purchase_suggestions_loaded`
- `purchase_saved`
- `invoice_created`
- `invoice_email_modal_opened`
- `invoice_email_sent`
- `invoice_quick_product_created`
- `invoice_quick_customer_created`
- `$pageview`

PostHog automatically adds client context such as browser, device, referrer, and timestamps.

## How To Add New Events

Frontend analytics:

1. Import `captureAnalyticsEvent` from [client.ts](/c:/Users/ASUS/Desktop/billsutra-dadu/front-end/src/lib/observability/client.ts)
2. Call it from the existing user interaction point with a concise event name and safe properties

Frontend error capture:

1. Import `captureFrontendException` from [shared.ts](/c:/Users/ASUS/Desktop/billsutra-dadu/front-end/src/lib/observability/shared.ts)
2. Pass the error plus tags/extra context

Backend error capture:

1. Import `captureServerException` or `captureServerMessage` from [observability.ts](/c:/Users/ASUS/Desktop/billsutra-dadu/server/src/lib/observability.ts)
2. Include only safe payload details in `extra`

## Debugging

- Frontend:
  - verify `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY` are set
  - trigger a client error and confirm it appears in Sentry
  - open the browser network tab and confirm PostHog requests reach `NEXT_PUBLIC_POSTHOG_HOST`
- Backend:
  - verify `SENTRY_DSN` is set in the server process
  - hit an endpoint that throws and confirm the event appears in Sentry with `request_id`
  - inspect the response headers for `x-request-id`

## Privacy And Opt-Out

- Sensitive request fields are redacted before telemetry is sent
- Product analytics can be disabled by calling `setAnalyticsOptOut(true)` from [client.ts](/c:/Users/ASUS/Desktop/billsutra-dadu/front-end/src/lib/observability/client.ts)
- To default analytics off, set `NEXT_PUBLIC_ANALYTICS_OPT_OUT_DEFAULT=true`

## Recommended Alerts

Create these in Sentry:

- `fatal` and `error` issues for production with frequency `> 5 events in 10 minutes`
- slow-request warning spikes tagged `kind=slow_request`
- payment flow issues tagged `flow=payments.store`

Create these in PostHog:

- funnel for `auth_signup_started -> auth_signup_succeeded -> auth_login_succeeded`
- funnel for `purchase_suggestions_loaded -> purchase_saved`
- funnel for `invoice_created -> invoice_email_sent`
- retention report on authenticated users using `auth_login_succeeded`
