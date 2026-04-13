# BillSutra — Server

This is the **Express.js REST API** that powers BillSutra. It handles all business logic: authentication, invoicing, sales, purchases, inventory, payments, analytics, file imports, PDF generation, and recurring invoice automation.

---

## 🛠 Tech Stack

| Tool | Purpose |
|---|---|
| **Node.js** + **Express 5** | HTTP server and routing |
| **TypeScript** (ESM) | Static typing, compiled with `tsc` / run with `tsx` |
| **Prisma ORM 6** | Type-safe database access and migrations |
| **PostgreSQL** | Relational database |
| **JWT** (jsonwebtoken) | Stateless API authentication (365-day tokens) |
| **bcryptjs** | Password hashing (cost factor 12) |
| **Puppeteer** | Headless Chromium for server-side PDF generation |
| **Resend** | Sending transactional emails |
| **node-cron** | Daily cron job for recurring invoices (runs at midnight) |
| **Multer** | Multipart file upload handling for bulk imports |
| **csv-parser** | Parsing CSV files during import |
| **xlsx** | Parsing Excel/XLSX files during import |
| **Zod** | Request body/query/params schema validation |
| **express-rate-limit** | Rate limiting on auth endpoints |
| **Morgan** | HTTP request logging |
| **CORS** | Cross-origin resource sharing |

---

## 📁 Project Structure

```
server/
├── prisma/
│   ├── schema.prisma           # Prisma data models (15+ models)
│   ├── seed.ts                 # DB seeder (templates, sample data)
│   └── migrations/             # Auto-generated migration files
├── src/
│   ├── index.ts                # Entry point (starts server + cron jobs)
│   ├── app.ts                  # Express app setup (middleware, routes)
│   ├── config/
│   │   ├── db.config.ts        # PrismaClient singleton
│   │   └── mongoose.ts         # (legacy config file)
│   ├── routes/
│   │   └── index.ts            # All API routes registered here
│   ├── controllers/            # Request handlers (22 controllers)
│   │   ├── AuthController.ts
│   │   ├── UsersController.ts
│   │   ├── BusinessProfileController.ts
│   │   ├── CustomersController.ts
│   │   ├── SuppliersController.ts
│   │   ├── CategoriesController.ts
│   │   ├── ProductsController.ts
│   │   ├── WarehousesController.ts
│   │   ├── InventoriesController.ts
│   │   ├── PurchasesController.ts
│   │   ├── SalesController.ts
│   │   ├── PaymentsController.ts
│   │   ├── PublicInvoiceController.ts
│   │   ├── TemplatesController.ts
│   │   ├── UserTemplateController.ts
│   │   ├── UserSavedTemplateController.ts
│   │   ├── ReportsController.ts
│   │   ├── AnalyticsController.ts
│   │   ├── DashboardController.ts
│   │   ├── StockController.ts
│   │   └── HealthController.ts
│   ├── modules/
│   │   ├── invoice/            # Invoice service, controller, routes, notifications
│   │   └── import/             # Bulk CSV/XLSX import service, controller, routes
│   ├── middlewares/
│   │   ├── AuthMiddleware.ts   # JWT Bearer token verification
│   │   ├── rateLimit.middleware.ts  # Auth rate limiter
│   │   ├── validate.ts         # Zod request validation middleware
│   │   └── error.middleware.ts # Global error handler
│   ├── jobs/
│   │   └── recurringInvoice.job.ts  # Cron: daily auto-invoice creation
│   ├── services/
│   │   └── dashboardAnalyticsService.ts  # Dashboard helpers (forecast, cashflow)
│   ├── validations/
│   │   └── apiValidations.ts   # All Zod schemas for API inputs
│   ├── utils/
│   │   ├── AppError.ts         # Custom error class with status code
│   │   ├── sendResponse.ts     # Standardized JSON response helper
│   │   ├── calculateTotals.ts  # Invoice/sale total computation (subtotal, tax, discount)
│   │   └── generateInvoiceNumber.ts  # Sequential invoice number generator
│   ├── types/                  # TypeScript type declarations
│   └── emails/                 # Resend templates and sendEmail(type, data)
├── uploads/                    # Temp storage for imported files (Multer)
├── .env                        # Environment variables
├── package.json
└── tsconfig.json
```

---

## 🗄 Database Schema Summary

All tables belong to a single PostgreSQL database managed by Prisma.

| Model | Description |
|---|---|
| `User` | Registered users (credentials or OAuth) |
| `BusinessProfile` | Company details per user (one-to-one) |
| `Customer` | Customer contacts per user |
| `Supplier` | Supplier contacts per user |
| `Category` | Product categories per user |
| `Product` | Products with SKU, barcode, pricing, GST, stock |
| `Warehouse` | Physical warehouse locations per user |
| `Inventory` | Stock quantity of a product in a warehouse |
| `Purchase` | Purchase orders with items and payment status |
| `PurchaseItem` | Line items of a purchase |
| `Sale` | Sales records with items and payment status |
| `SaleItem` | Line items of a sale |
| `Invoice` | Customer invoices with status lifecycle |
| `InvoiceItem` | Line items of an invoice |
| `RecurringInvoiceTemplate` | Templates for auto-generated recurring invoices |
| `Payment` | Payments recorded against invoices |
| `StockMovement` | Audit trail for inventory changes |
| `Template` | System invoice layout templates |
| `TemplateSection` | Sections within a template |
| `UserTemplate` | User's active template configuration |
| `UserSavedTemplate` | Named saved template presets per user |
| `PasswordResetToken` | Time-limited tokens for password reset |

---

## 🔌 API Reference

All endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | ❌ | OAuth login / upsert |
| POST | `/auth/logincheck` | ❌ | Credentials login |
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/forgot-password` | ❌ | Generate and email reset link |
| POST | `/auth/reset-password` | ❌ | Reset password with token |

### User & Profile
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | ✅ | Get current user |
| PUT | `/users/me` | ✅ | Update profile info |
| PUT | `/users/password` | ✅ | Change password |
| GET | `/business-profile` | ✅ | Get business profile |
| POST | `/business-profile` | ✅ | Create/update business profile |

### Customers, Suppliers, Categories, Products, Warehouses
All follow the same RESTful CRUD pattern:
```
GET     /resource          → list all
POST    /resource          → create
GET     /resource/:id      → get one
PUT     /resource/:id      → update
DELETE  /resource/:id      → delete
```

### Inventory
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/inventories` | ✅ | List stock (filter by warehouse) |
| POST | `/inventories/adjust` | ✅ | Manual stock adjustment |

### Purchases & Sales
Both support: `GET /list`, `POST /create`, `GET /:id`, `PUT /:id`  
Sales additionally: `DELETE /:id`

### Invoices (`/api/invoices`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/invoices` | ✅ | List (filter by status, client, date) |
| POST | `/invoices` | ✅ | Create invoice (optional sales + inventory sync) |
| GET | `/invoices/:id` | ✅ | Get invoice details |
| PUT | `/invoices/:id` | ✅ | Update invoice |
| DELETE | `/invoices/:id` | ✅ | Delete invoice |
| POST | `/invoices/:id/send` | ✅ | Mark as sent (status → SENT) |
| POST | `/invoices/:id/duplicate` | ✅ | Duplicate invoice |
| GET | `/invoices/:id/pdf` | ✅ | Download invoice as PDF |
| POST | `/invoices/:id/reminder` | ✅ | Send invoice reminder email |
| GET | `/public/invoice/:id` | ❌ | Public invoice view (no auth) |

### Payments
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/payments` | ✅ | List all payments |
| GET | `/payments/:invoiceId` | ✅ | Payments for specific invoice |
| POST | `/payments` | ✅ | Record a payment |

### Templates
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/templates` | ✅ | List system templates |
| GET | `/user-template` | ✅ | Get user's active template config |
| POST | `/user-template` | ✅ | Save user template settings |
| GET | `/user-saved-templates` | ✅ | List saved templates |
| POST | `/user-saved-templates` | ✅ | Create saved template |
| PUT | `/user-saved-templates/:id` | ✅ | Update saved template |
| DELETE | `/user-saved-templates/:id` | ✅ | Delete saved template |

### Import
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/import/customers` | ✅ | Bulk import customers (CSV/XLSX) |
| POST | `/import/suppliers` | ✅ | Bulk import suppliers |
| POST | `/import/products` | ✅ | Bulk import products |
| POST | `/import/categories` | ✅ | Bulk import categories |
| POST | `/import/warehouses` | ✅ | Bulk import warehouses |

### Dashboard & Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/overview` | KPIs, profits, alerts, activity |
| GET | `/dashboard/sales` | Sales charts (7d, 30d, 6mo, by category) |
| GET | `/dashboard/inventory` | Stock metrics and low stock list |
| GET | `/dashboard/transactions` | Last 10 transactions |
| GET | `/dashboard/customers` | Customer analytics and top buyers |
| GET | `/dashboard/suppliers` | Supplier payables |
| GET | `/dashboard/cashflow` | Inflow/outflow analysis |
| GET | `/dashboard/forecast` | Sales forecast |
| GET | `/analytics/overview` | Aggregated analytics |
| GET | `/reports/summary` | Profit/loss summary report |

---

## ⚙️ Environment Variables (`server/.env`)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/billsutra

# JWT
JWT_SECRET=your-very-secret-jwt-key

# Server
PORT=5000

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

### Required At Startup

- `JWT_SECRET` (required): used for signing/verifying auth tokens. The server now fails fast on boot if missing.
- `DATABASE_URL` (required): Prisma database connection.

### Optional / Feature-Specific

- `PORT`: API port (defaults to `7000` if not provided).
- `FRONTEND_URL`, `CORS_ORIGIN`, `CORS_ORIGINS`: CORS allowlist configuration.
- `RESEND_API_KEY`: required only for email features (OTP, reset, transactional emails).

---

## 🚀 Setup & Running

### Requirements
- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# 3. Run database migrations
npx prisma migrate dev

# 4. (Optional) Seed database with sample data
npm run seed

# 5. Start development server
npm run dev

# (Alternative) If running from monorepo root
npm run dev --prefix server
```

The server starts at **http://localhost:5000**.

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload via `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled build (`node dist/index.js`) |
| `npm run watch` | Watch TypeScript files (`tsc -w`) |
| `npm run seed` | Run Prisma seed script |

---

## 🔄 Recurring Invoice Cron Job

A `node-cron` job runs at **00:00 server time every day**. It:

1. Queries all active `RecurringInvoiceTemplate` records where `next_run_date <= now`
2. For each template, creates a new `DRAFT` invoice with the configured items, discount, and due date
3. Updates `last_run_date` and advances `next_run_date` by the configured frequency

Supported frequencies: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` with a custom `interval_count` multiplier.

---

## 📄 PDF Generation

Invoice PDFs are generated server-side using **Puppeteer** (headless Chromium):

1. The invoice and business profile are loaded from the database
2. An HTML invoice template is rendered with all data
3. Puppeteer launches a headless browser, loads the HTML, and captures it as an A4 PDF
4. The PDF buffer is streamed directly to the client as a downloadable file

---

## 🔒 Security Notes

- All private routes require a valid `Bearer` JWT token via `AuthMiddleware`
- Auth endpoints (`/auth/login`, `/auth/register`) are rate-limited via `express-rate-limit`
- Passwords are hashed with `bcryptjs` (cost factor 12) before storage
- Password reset tokens expire after 30 minutes and can only be used once
- All request bodies are validated with **Zod** schemas before reaching controllers
