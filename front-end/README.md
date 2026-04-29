# BillSutra — Front-End

This is the **Next.js** web application for BillSutra. It provides the UI for managing invoices, sales, purchases, inventory, and all business analytics.

---

## Required Features (Baseline)

- Secure authentication UX for owner/admin/worker flows
- Complete workspace for invoices, sales, purchases, CRM, and inventory
- Consistent state management and validation for forms and API interactions
- Dashboard-first experience with actionable financial and operational insights
- Responsive and accessible interface patterns across business-critical pages

## Updated Features (April 2026)

- Added facial recognition UI flow (registration and login integration points)
- Improved dashboard KPI layout to better separate inbound and outbound payment pressure
- Refined inventory risk visualization to align summary counts with detailed risk lists
- Continued feature parity alignment with backend analytics and auth capabilities

---

## 🛠 Tech Stack

| Tool | Purpose |
|---|---|
| **Next.js 16** (App Router) | React meta-framework, file-based routing |
| **React 19** | UI library |
| **TypeScript** | Static typing |
| **TailwindCSS 4** | Utility-first CSS framework |
| **Radix UI** | Accessible headless UI primitives (dialog, dropdown, alert-dialog, avatar) |
| **NextAuth v4** | Authentication: credentials + Google OAuth |
| **TanStack Query** | Server-state management and data fetching |
| **TanStack Table** | Headless table with sortable/filterable columns |
| **Recharts** | Charts for analytics (bar, line, pie) |
| **Axios** | HTTP client for API calls |
| **Zod** | Schema validation (forms, API responses) |
| **Lucide React** | Icon library |
| **next-themes** | Dark/light mode toggle |
| **Sonner** | Toast notifications |

---

## 📁 Project Structure

```
front-end/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth group (login, register, forgot-password)
│   │   ├── dashboard/          # Main dashboard with analytics tabs
│   │   ├── invoices/           # Invoice list, create, edit, view
│   │   ├── sales/              # Sales list, create, edit, view
│   │   ├── purchases/          # Purchase list, create, edit, view
│   │   ├── customers/          # Customer list, create, edit
│   │   ├── suppliers/          # Supplier list, create, edit
│   │   ├── products/           # Product list, create, edit
│   │   ├── inventory/          # Inventory view and stock adjustment
│   │   ├── warehouses/         # Warehouse list, create, edit
│   │   ├── business-profile/   # Business profile setup
│   │   ├── profile/            # User profile and password change
│   │   ├── settings/           # App settings
│   │   ├── templates/          # Invoice template selection & customization
│   │   ├── pdf/                # Invoice PDF preview page
│   │   └── api/                # Next.js API routes (NextAuth, etc.)
│   ├── components/
│   │   ├── ui/                 # Shared UI primitives (button, dialog, input, etc.)
│   │   ├── common/             # Shared app components (sidebar, header, etc.)
│   │   ├── dashboard/          # Dashboard-specific chart and metric components
│   │   ├── invoice/            # Invoice form and display components
│   │   ├── invoices/           # Invoice list table components
│   │   ├── auth/               # Auth form components
│   │   ├── profile/            # Profile form components
│   │   ├── hero.tsx            # Landing hero section
│   │   ├── features.tsx        # Features section
│   │   ├── benefits.tsx        # Benefits section
│   │   ├── pricing.tsx         # Pricing section
│   │   ├── navbar.tsx          # Landing navbar
│   │   └── footer.tsx          # Footer
│   ├── actions/                # Server actions / API call utilities
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Shared utilities (axios instance, helpers)
│   ├── providers/              # React context providers (auth, query, theme)
│   ├── types/                  # TypeScript types for API data models
│   └── middleware.ts           # NextAuth JWT route guard for /dashboard/**
├── public/                     # Static assets
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 🔐 Authentication Flow

1. User visits any `/dashboard/` route → intercepted by `middleware.ts`
2. Middleware reads NextAuth JWT from cookie
3. If no token → redirect to `/` (landing page with login) + `callbackUrl` param
4. After login (credentials or Google OAuth) → NextAuth session created
5. Front-end passes the JWT to the back-end API as a `Bearer` token in headers

---

## 📱 Pages Overview

| Route | Description |
|---|---|
| `/` | Landing page (hero, features, pricing, CTA) |
| `/(auth)/login` | Sign in with email/password or Google |
| `/(auth)/register` | Create a new account |
| `/forgot-password` | Request password reset |
| `/dashboard` | Business overview (metrics, charts, recent activity) |
| `/invoices` | Invoice list, create, edit, PDF download, send |
| `/sales` | Sales records |
| `/purchases` | Purchase orders |
| `/customers` | Customer CRM |
| `/suppliers` | Supplier management |
| `/products` | Product catalog with SKU, GST, pricing |
| `/inventory` | Warehouse-level stock view + adjustments |
| `/warehouses` | Warehouse management |
| `/business-profile` | Company details for invoices |
| `/profile` | User account settings |
| `/settings` | App-level settings |
| `/templates` | Invoice template customization |
| `/pdf` | Invoice PDF viewer |

---

## 🔧 Setup & Installation

### Requirements
- Node.js 18+
- A running BillSutra server (see `server/README.md`)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your values (see below)

# 3. Start development server
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## ⚙️ Environment Variables (`front-end/.env.local`)

```env
# NextAuth
NEXTAUTH_URL=https://app.example.com
NEXTAUTH_SECRET=replace-with-a-long-random-secret

# Preferred backend base URL
NEXT_PUBLIC_BACKEND_URL=https://api.example.com

# Legacy alias still supported
NEXT_PUBLIC_API_URL=https://api.example.com/api

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 🎨 UI Notes

- **Dark/Light mode**: Supported via `next-themes` with a toggle button in the navbar
- **Toast notifications**: Powered by `Sonner` — appears on create/update/delete/error events
- **Tables**: Fully sortable and filterable using `TanStack Table`
- **Charts**: Bar charts, line charts, and pie charts via `Recharts`
- **Forms**: Validated with `Zod` schemas before API submission
