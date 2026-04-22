# BillSutra

**BillSutra** is an all-in-one business management and billing platform built for small and medium businesses. It covers the complete business workflow — from invoicing and sales to inventory, purchases, payments, and analytics.

---

## Required Features (Baseline)

- Secure authentication with protected workspace access
- Complete billing lifecycle: invoices, payments, reminders, and PDF sharing
- Inventory-aware operations for sales, purchases, products, and warehouses
- Business analytics for cashflow, receivables, payables, and trends
- Production-ready setup with clear environment and deployment docs

## Updated Features (April 2026)

- Facial recognition login and face registration flow has been added (see facial recognition docs)
- Dashboard analytics has improved KPI separation for pending sales vs pending purchases
- Inventory risk presentation now clearly separates low-stock and out-of-stock states
- Feature-specific documentation has been aligned across root, frontend, and server README files

---

## 📐 Project Structure

```
billsutra/
├── front-end/          # Next.js 16 web application (App Router)
├── server/             # Express.js REST API with Prisma + PostgreSQL
├── feature_summary.txt # Complete feature list (detailed)
└── README.md           # This file
```

Each sub-project has its own `README.md` with full setup instructions:
- [`front-end/README.md`](./front-end/README.md)
- [`server/README.md`](./server/README.md)

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 🔐 Authentication | Email/password + OAuth (Google), JWT, password reset |
| 🧾 Invoicing | Create, send, duplicate, PDF download, public share link |
| 🔁 Recurring Invoices | Auto-invoice via daily cron (Daily/Weekly/Monthly/Yearly) |
| 📦 Inventory | Multi-warehouse stock tracking, adjustments, movement audit |
| 🛍 Sales & Purchases | Full CRUD with payment tracking (Paid/Partial/Unpaid) |
| 👥 CRM | Customers & Suppliers with pending payment visibility |
| 📊 Dashboard | Real-time metrics, charts, cashflow, forecasting |
| 📥 Bulk Import | Import customers/products/etc. via CSV or XLSX |
| 🏢 Business Profile | Company logo, tax ID, currency, invoice display settings |
| 🎨 Invoice Templates | Customizable layouts with per-user saved templates |

> See [`feature_summary.txt`](./feature_summary.txt) for the full detailed breakdown of every feature.

---

## 🛠 Technology Stack

### Front-End
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **TailwindCSS 4** + **Radix UI** for styling and accessible components
- **NextAuth v4** for authentication (credentials + OAuth)
- **TanStack Query** for server-state management
- **TanStack Table** for data tables
- **Recharts** for analytics charts
- **Zod** for client-side validation

### Back-End
- **Node.js** + **Express 5** + **TypeScript** (ESM modules)
- **Prisma ORM 6** + **PostgreSQL**
- **Puppeteer** for server-side PDF generation
- **Resend** for transactional email delivery
- **node-cron** for recurring invoice automation
- **Multer** + **csv-parser** + **xlsx** for bulk file import
- **JWT** + **bcryptjs** for auth security
- **Zod** for request validation

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- PostgreSQL database

### 1. Start the Server
```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev
npm run dev            # runs on http://localhost:5000
```

### 2. Start the Front-End
```bash
cd front-end
cp .env.local.example .env.local   # set NEXTAUTH_SECRET, NEXT_PUBLIC_API_URL, etc.
npm install
npm run dev                        # runs on http://localhost:3000
```

---

## 📋 Environment Variables

### Server (`server/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `PORT` | Server port (default: 5000) |
| `RESEND_API_KEY` | Resend API key for email delivery |

### Front-End (`front-end/.env.local`)
| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | App base URL (e.g. http://localhost:3000) |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

---

## 📖 More Documentation

- **All features in detail** → [`feature_summary.txt`](./feature_summary.txt)
- **Front-end setup & pages** → [`front-end/README.md`](./front-end/README.md)
- **Server API & architecture** → [`server/README.md`](./server/README.md)
