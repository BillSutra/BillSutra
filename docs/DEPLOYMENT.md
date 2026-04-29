# BillSutra Deployment Guide

This repo is prepared to run in three environments:

- Local development
- Staging
- Production

## Services

- `front-end`: Next.js application
- `server`: Express API
- `worker`: BullMQ background worker from the `server` package
- `postgres`: Prisma-managed PostgreSQL database
- `redis`: shared cache, rate limiting, realtime throttling, and optional BullMQ queue transport

## Environment Model

### Backend env file precedence

The backend loader reads these files in order and lets later files override earlier ones:

1. `server/.env`
2. `server/.env.<APP_ENV>`
3. `server/.env.local` when `APP_ENV=development`
4. `server/.env.<APP_ENV>.local`

You can also point to a specific file with `SERVER_ENV_FILE`.

### Frontend env file precedence

The frontend now supports:

1. `front-end/.env`
2. `front-end/.env.<APP_ENV>`
3. `front-end/.env.local` when `APP_ENV=development`
4. `front-end/.env.<APP_ENV>.local`

Next.js standard env loading still works. The extra loader is there to support `APP_ENV=staging`.

### Example templates

- Shared backend baseline: `server/.env.example`
- Backend overrides:
  - `server/.env.development.example`
  - `server/.env.staging.example`
  - `server/.env.production.example`
- Shared frontend baseline: `front-end/.env.example`
- Frontend overrides:
  - `front-end/.env.development.example`
  - `front-end/.env.staging.example`
  - `front-end/.env.production.example`

## Local Development

### 1. Install dependencies

```powershell
npm ci
```

### 2. Create env files

- Copy `server/.env.example` to `server/.env`
- Optionally copy `server/.env.development.example` values into `server/.env.development`
- Copy `front-end/.env.example` to `front-end/.env.local`
- Optionally copy `front-end/.env.development.example` values into `front-end/.env.development`

### 3. Generate Prisma client

```powershell
cd server
npx prisma generate
```

### 4. Start services

Frontend:

```powershell
npm run dev:frontend
```

Backend:

```powershell
npm run dev:server
```

Worker:

```powershell
npm run dev:worker
```

Notes:

- Local Redis is optional when `USE_REDIS_CACHE=false`, `USE_REDIS_RATE_LIMIT=false`, and `USE_QUEUE=false`
- Local uploads default to `server/uploads`
- Local passkeys should use `WEBAUTHN_ORIGIN=http://localhost:3000` and `WEBAUTHN_RP_ID=localhost`

## Staging

Recommended environment:

- `APP_ENV=staging`
- Backend `NODE_ENV=production`
- Frontend `NODE_ENV=production`
- Separate staging database and Redis
- Separate staging Razorpay webhook secrets and OAuth credentials

Suggested staging topology:

- Frontend: Vercel preview or dedicated staging project
- Backend API: Railway or Render service
- Worker: Railway or Render worker service
- Database: managed Postgres
- Redis: Upstash or managed Redis with TCP support when `USE_QUEUE=true`

## Production

### Required startup order

1. Provision Postgres
2. Provision Redis
3. Apply backend environment variables
4. Run Prisma migration deploy
5. Start API
6. Start worker
7. Start frontend
8. Enable scheduler on exactly one API or worker-adjacent runtime if desired

### Prisma commands

```powershell
cd server
npx prisma generate
npx prisma migrate deploy
```

### Health checks

- Liveness: `GET /health`
- Readiness: `GET /ready`
- API aliases: `GET /api/health`, `GET /api/ready`

### Persistent storage

Set `UPLOADS_ROOT` to a persistent disk mount in staging and production.

Examples:

- Linux VM: `/var/lib/billsutra/uploads`
- Railway volume mount: `/app/data/uploads`
- Render disk mount: `/var/data/billsutra/uploads`

## Recommended Hosting

### Best default

`Vercel(frontend) + Railway(API + worker) + managed Postgres + Upstash Redis`

Why:

- easiest Next.js deployment
- simple API and worker separation
- straightforward env and secret management
- managed Postgres and Redis fit current architecture well

### Other supported options

- `AWS EC2 + Nginx + PM2` for more control and lower long-term cost
- `Render` for simpler all-in-one managed services
- `Railway` for fastest full-stack setup outside Vercel

## PM2 Example

Backend API:

```powershell
pm2 start dist/index.js --name billsutra-api
```

Worker:

```powershell
pm2 start "npm run worker" --name billsutra-worker
```

## Local Production Smoke Test

Frontend:

```powershell
cd front-end
npm run build
npm start
```

Backend:

```powershell
cd server
npm run build
npm start
```

Worker:

```powershell
cd server
npm run worker
```

## Rollback Plan

1. Keep the previous frontend deployment active until the new API and worker are healthy
2. Deploy backend and worker before switching frontend traffic
3. If release health checks fail:
   - scale traffic back to the previous frontend deployment
   - restart previous API and worker release
   - if needed, restore database from the most recent backup
4. Do not roll back Prisma migrations manually unless a migration-specific restore plan exists

## Production Notes

- Set `ENABLE_SCHEDULER=true` on exactly one runtime only
- Keep `TRUST_PROXY=1` or the correct hop count behind a load balancer
- Keep `USE_QUEUE=true` only when TCP Redis is available
- Keep `SECURE_FILE_SIGNING_SECRET`, JWT secrets, and payment secrets unique per environment
- Use separate OAuth, passkey, and Razorpay credentials for staging and production
