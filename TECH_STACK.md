# BillSutra Tech Stack

## Overview

BillSutra is a monorepo-based business application with:

- a `front-end` web app built on Next.js
- a `server` API built on Express + Prisma
- a PostgreSQL database
- Redis-backed caching and queues
- real-time updates over Socket.IO and Server-Sent Events
- a separate Python face-recognition service

## Monorepo and Workspace

- Package manager: `npm`
- Workspace layout: root npm workspaces
- Root workspaces:
  - `front-end`
  - `server`
- Primary language across JS apps: `TypeScript`

## Frontend

### Core framework

- `Next.js 16.1.6`
- `React 19.2.0`
- `React DOM 19.2.0`
- App Router structure under `front-end/src/app`

### UI and styling

- `Tailwind CSS 4`
- `@tailwindcss/postcss`
- `tw-animate-css`
- `Radix UI`
  - `@radix-ui/react-alert-dialog`
  - `@radix-ui/react-avatar`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-slot`
- `lucide-react`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- Theme handling: `next-themes`

### State, data fetching, and tables

- `@tanstack/react-query`
- `axios`
- `@tanstack/react-table`

### Forms and validation

- `react-hook-form`
- `@hookform/resolvers`
- `zod`

### Charts and reporting UI

- `chart.js`
- `react-chartjs-2`
- `recharts`

### Auth and session handling

- `next-auth`
- `@simplewebauthn/browser`
- frontend auth/session sync with backend token flow

### Real-time and live updates

- `socket.io-client`
- native `EventSource` for SSE dashboard streams

### Client-side observability and analytics

- `@sentry/nextjs`
- `posthog-js`

### Browser-side documents and media

- `html2canvas`
- `jspdf`
- `jspdf-autotable`
- `face-api.js`

### Frontend testing and quality

- `Playwright`
- `ESLint 9`
- `eslint-config-next`
- `TypeScript 5`

## Backend

### Core framework

- `Express 5.1.0`
- Node.js runtime
- `tsx` for development/watch mode
- `typescript`

### ORM and database access

- `Prisma 6.18.0`
- `@prisma/client 6.18.0`
- Prisma migrations and seed support

### Database

- `PostgreSQL`
- Prisma datasource provider: `postgresql`

### Authentication and security

- `jsonwebtoken`
- `bcryptjs`
- `@simplewebauthn/server`
- cookie-based refresh/session flow in server auth helpers
- role-based access for OWNER / ADMIN style flows

### API and middleware

- `cors`
- `morgan`
- `multer`
- `express-rate-limit`
- Redis-backed rate limiter with fallback support in the codebase

### Real-time and streaming

- `socket.io`
- SSE endpoints for dashboard/live updates

### Background jobs and scheduling

- `bullmq`
- `node-cron`

### Caching and infrastructure helpers

- `ioredis`
- in-memory caching layered with Redis in analytics/dashboard services

### Email and notifications

- `nodemailer`
- `resend`
- `handlebars` for templated emails

### File processing and document generation

- `xlsx`
- `csv-parser`
- `puppeteer`

## Data and Reporting Stack

- PostgreSQL as the primary relational database
- Prisma schema and migrations under `server/prisma`
- dashboard analytics, cached metrics, and reports on the backend
- PDF generation for invoice/report style outputs
- spreadsheet and CSV import/export support

## Real-Time Architecture

- REST APIs for standard CRUD/business actions
- `Socket.IO` for push-style events and notifications
- `Server-Sent Events` for dashboard streaming
- React Query cache invalidation/refresh on live events

## Observability and Analytics

- `Sentry`
  - frontend: `@sentry/nextjs`
  - backend: `@sentry/node`
- `PostHog` for product analytics on the frontend
- server-side request/query logging via application logging and `morgan`

## Authentication Stack

- `NextAuth` on the frontend
- custom backend auth controllers and middleware on Express
- `JWT` access/refresh token handling
- `SimpleWebAuthn` for passkeys/WebAuthn support
- `bcryptjs` for password hashing
- cookies used for session persistence and refresh flow

## Background Processing and Performance

- `BullMQ` queues for worker jobs
- `Redis` for:
  - cache storage
  - queue backing
  - rate-limit support
- `node-cron` for scheduled jobs

## Testing and Developer Tooling

- `TypeScript`
- `tsx`
- `ESLint`
- `Playwright`
- Prisma CLI
- npm workspaces

## Auxiliary Face Recognition Service

There is a separate Python service in `face_recognition_service`.

### Core stack

- `Python`
- `Flask 3.0.3`
- `flask-cors 4.0.1`
- `python-dotenv 1.0.1`

### Computer vision and ML-related libraries

- `face-recognition 1.3.0`
- `opencv-python 4.10.0.84`
- `numpy 1.26.4`
- `Pillow 10.4.0`

### Service role

- face recognition and face-encoding operations
- launched via PowerShell helper from the workspace root

## High-Level Architecture Summary

- Frontend: `Next.js + React + Tailwind + React Query + NextAuth`
- Backend: `Express + Prisma + PostgreSQL`
- Auth: `JWT + NextAuth + WebAuthn/passkeys`
- Realtime: `Socket.IO + SSE`
- Cache and jobs: `Redis + BullMQ + node-cron`
- Observability: `Sentry + PostHog`
- Documents and exports: `Puppeteer + jsPDF + xlsx + csv-parser`
- Computer vision: `Python + Flask + face-recognition + OpenCV`

## Key Directories

- `front-end/` - Next.js application
- `server/` - Express API and business logic
- `server/prisma/` - Prisma schema and migrations
- `face_recognition_service/` - Python face-recognition microservice
- `shared/` - shared project code/assets used across the repo
