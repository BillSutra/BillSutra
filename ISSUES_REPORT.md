# BillSutra Issues Report

Audit date: 2026-04-25

This file lists the main issues identified during source review. Severity reflects current production risk if the observed code paths are active.

## 1. Long-lived JWT access tokens

- Severity: High
- File location:
  - `server/src/lib/authSession.ts:293`
- Description:
  - Owner/worker session JWTs are issued with a `365d` expiry. A stolen bearer token would remain valid for an unusually long period.
- Root cause:
  - Session strategy uses long-lived stateless access tokens without short expiry + refresh rotation.
- Suggested fix:
  - Reduce access-token TTL to hours, not months.
  - Introduce refresh-token rotation or server-side session revocation strategy.
  - Invalidate tokens on password/security events by checking `session_version` consistently.

## 2. Bearer tokens are stored in browser-readable storage

- Severity: High
- File location:
  - `front-end/src/providers/AuthTokenSync.tsx:26`
  - `front-end/src/providers/AuthTokenSync.tsx:31`
  - `front-end/src/lib/adminAuth.ts:12`
  - `front-end/src/lib/adminAuth.ts:18-19`
  - `front-end/src/lib/adminAuth.ts:25-26`
- Description:
  - Tokens are stored in `localStorage`, and the admin token is also mirrored into a non-HttpOnly cookie. Any XSS vulnerability would expose authentication tokens immediately.
- Root cause:
  - Client-side convenience storage was chosen instead of secure cookie/session handling.
- Suggested fix:
  - Move auth to secure, `HttpOnly`, `SameSite`, `Secure` cookies.
  - Remove `localStorage` token persistence.
  - Centralize token refresh and revocation around server-managed sessions.

## 3. Sensitive uploads are publicly served from `/uploads`

- Severity: High
- File location:
  - `server/src/app.ts:57-61`
  - `server/src/services/accessPayments.service.ts:141`
  - `server/src/services/accessPayments.service.ts:146`
- Description:
  - Uploaded files are exposed through a public static route. This likely includes payment proofs and possibly other sensitive assets.
- Root cause:
  - The storage strategy uses local filesystem storage plus direct `express.static()` exposure for convenience.
- Suggested fix:
  - Move sensitive uploads to private/object storage.
  - Serve files through signed URLs or authenticated controller endpoints.
  - Separate public branding assets from private compliance/payment documents.

## 4. Face encodings are stored in plaintext despite documentation claiming encryption

- Severity: Critical
- File location:
  - `server/src/controllers/FaceRecognitionController.ts:542-543`
  - `server/src/controllers/FaceRecognitionController.ts:549-550`
  - `face_recognition_service/README.md:216-220`
- Description:
  - Biometric face encodings are stored as serialized text in the database. The project documentation states they are encrypted, but the implementation does not match that claim.
- Root cause:
  - Face-recognition feature was implemented with serialized vectors, but encryption-at-rest for biometric templates was not added.
- Suggested fix:
  - Encrypt biometric templates before persistence.
  - Minimize stored biometric data and consider one-way template protection where possible.
  - Update documentation immediately if encryption is not yet implemented.
  - Add explicit consent, retention, and delete guarantees for biometric data.

## 5. Face recognition sidecar allows wildcard browser origins

- Severity: High
- File location:
  - `face_recognition_service/app.py:42`
  - `face_recognition_service/app.py:46`
- Description:
  - The Flask face service enables CORS with `origins: "*"`, widening browser access unnecessarily for a highly sensitive biometric subsystem.
- Root cause:
  - Permissive development-time CORS remained in the sidecar service.
- Suggested fix:
  - Restrict origins to trusted frontend domains.
  - Require authenticated server-to-server access where possible.
  - Avoid direct browser exposure for biometric endpoints.

## 6. Payment recording is not transactional

- Severity: High
- File location:
  - `server/src/controllers/PaymentsController.ts:58`
  - `server/src/controllers/PaymentsController.ts:71`
  - `server/src/controllers/PaymentsController.ts:86`
- Description:
  - Payment creation, payment aggregation, invoice status update, and notification emission happen as separate steps. A failure after payment creation can leave invoice status out of sync.
- Root cause:
  - Multi-step financial write flow is not wrapped in a Prisma transaction.
- Suggested fix:
  - Wrap payment insert, aggregation/status recalculation, and invoice update in `prisma.$transaction`.
  - Make notification emission post-commit or retryable.
  - Add tests for partial-failure scenarios.

## 7. Worker profile support is implemented with runtime DDL instead of migrations

- Severity: High
- File location:
  - `server/src/controllers/WorkersController.ts:91-100`
  - `server/src/controllers/WorkerPanelController.ts:41-50`
- Description:
  - The application creates `worker_profiles` dynamically at request time with `CREATE TABLE IF NOT EXISTS`. This table is not part of the Prisma schema.
- Root cause:
  - Feature development outpaced schema management, so runtime SQL was used as a compatibility bridge.
- Suggested fix:
  - Add `worker_profiles` to Prisma schema and create a proper migration.
  - Remove runtime DDL from request handlers.
  - Generate typed Prisma accessors instead of raw SQL access.

## 8. Controllers are masking schema drift with raw SQL fallbacks

- Severity: Medium
- File location:
  - `server/src/controllers/CustomersController.ts:133`
  - `server/src/controllers/CustomersController.ts:165`
  - `server/src/controllers/CustomersController.ts:212`
  - `server/src/controllers/SuppliersController.ts:111`
  - `server/src/controllers/SuppliersController.ts:145`
  - `server/src/controllers/SuppliersController.ts:257`
- Description:
  - Customer and supplier controllers catch missing-column/table errors and silently degrade to fallback SQL. This keeps the app limping through mismatched schemas but hides operational drift.
- Root cause:
  - Database migrations are not enforced strongly enough across environments, so controllers compensate for multiple schema versions.
- Suggested fix:
  - Enforce migration application during deployment/startup.
  - Fail fast when critical schema is missing.
  - Remove fallback SQL once schema parity is guaranteed.

## 9. Product barcode validation is not consistently tenant-scoped

- Severity: Medium
- File location:
  - `server/src/controllers/ProductsController.ts:134-135`
  - `server/src/controllers/ProductsController.ts:214-215`
  - `server/prisma/schema.prisma:337-338`
- Description:
  - The controller checks for existing barcode by `barcode` alone, while the schema uniqueness is actually `@@unique([user_id, barcode])`. This can incorrectly block another tenant from using the same barcode.
- Root cause:
  - Controller-level uniqueness check does not match Prisma schema design.
- Suggested fix:
  - Scope barcode existence checks by `user_id`.
  - Add tests for same-barcode-different-tenant cases.

## 10. Frontend imports contract types directly from backend source tree

- Severity: Medium
- File location:
  - `front-end/src/lib/apiClient.ts:6`
- Description:
  - Frontend imports `assistant.contract` directly from `../../../server/src/...`. This tightly couples the frontend build to backend internal file layout.
- Root cause:
  - Shared contract types were never extracted into a dedicated shared package.
- Suggested fix:
  - Move shared types/contracts into `shared/` or a workspace package.
  - Keep package boundaries explicit so frontend can build independently of backend internals.

## 11. `Business.ownerId` is stored as a string instead of a real foreign key

- Severity: Medium
- File location:
  - `server/prisma/schema.prisma:115-121`
  - `server/src/controllers/AdminController.ts:7-8`
  - `server/src/controllers/AdminController.ts:76-82`
- Description:
  - Business ownership is stored as `ownerId String`, while users are keyed by integer IDs. The admin controller repeatedly parses owner IDs back into integers to resolve relationships.
- Root cause:
  - Legacy schema mismatch between tenancy/business model and user identity model.
- Suggested fix:
  - Replace `ownerId String` with `owner_user_id Int` plus a proper relation to `User`.
  - Backfill existing data in a migration.
  - Remove parsing helpers once the FK exists.

## 12. Worker authorization is based on brittle path-prefix allowlists

- Severity: Medium
- File location:
  - `server/src/middlewares/AuthMIddleware.ts:9`
  - `server/src/middlewares/AuthMIddleware.ts:23-24`
  - `server/src/middlewares/AuthMIddleware.ts:90`
- Description:
  - Worker access control is partly determined by whether request paths start with hardcoded prefixes. This is easy to miss when new routes are added and can lead to accidental overexposure or unexpected denial.
- Root cause:
  - Authorization policy is encoded in routing conventions instead of centralized capability mapping.
- Suggested fix:
  - Move to explicit permission checks per route/domain action.
  - Keep worker capabilities in one permission matrix rather than string-prefix logic.
  - Add automated access-control tests for worker routes.

## 13. Legacy and unused code increases maintenance risk

- Severity: Low
- File location:
  - `server/src/controllers/InvoicesController.ts`
  - `server/src/modules/invoice/*`
  - `server/src/config/mongoose.ts`
- Description:
  - The repository contains both a newer modular invoice implementation and an older invoice controller, plus a MongoDB connection helper in a Prisma/PostgreSQL project. These leftovers increase confusion and onboarding cost.
- Root cause:
  - Refactors introduced new patterns without removing old artifacts.
- Suggested fix:
  - Delete or archive unused controllers/config.
  - Keep only one canonical invoice implementation.
  - Document migration/refactor decisions in ADRs or technical notes.

## 14. Documentation is out of sync with the repository

- Severity: Low
- File location:
  - `README.md:30`
  - `README.md:55`
  - `README.md:130`
  - `front-end/README.md:86`
  - `front-end/README.md:97`
- Description:
  - Root README references `feature_summary.txt`, which is not present. Frontend README documents `middleware.ts`, while the repo currently contains `src/proxy.ts` instead.
- Root cause:
  - Documentation was not updated as the codebase evolved.
- Suggested fix:
  - Refresh README files as part of release hygiene.
  - Add a lightweight doc validation checklist in PR review.

## Recommended remediation order

1. Fix token security, public uploads, biometric storage, and face-service CORS.
2. Transactionalize financial writes and remove runtime schema workarounds.
3. Normalize data model issues (`worker_profiles`, `Business.ownerId`, tenant-scoped validation).
4. Reduce coupling and code drift by extracting shared contracts and deleting legacy artifacts.
