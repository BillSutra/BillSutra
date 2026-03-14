# BILLSUTRA - COMPLETE CODEBASE DOCUMENTATION & FEATURE ROADMAP

## 1. PROJECT OVERVIEW

**BillSutra** is a production-ready, full-stack **business management and billing platform** designed for small and medium-sized businesses (SMBs). It serves as an all-in-one solution for managing the entire business workflow from invoicing to inventory management, covering sales, purchases, payments, customer relationships, and financial analytics.

**Target Users:** SMBs, freelancers, small retailers, service providers
**Current Status:** Actively developed (25+ database migrations, comprehensive feature set)
**Deployment:** Web-based SaaS platform

---

## 2. TECHNOLOGY STACK

### Frontend
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: TailwindCSS 4 + Radix UI (accessible components library)
- **State Management**: TanStack Query v5 (server-state caching + auto-invalidation)
- **Data Tables**: TanStack Table v8 (headless table with sorting/filtering)
- **Authentication**: NextAuth v4 (credentials + OAuth support)
- **Charts & Visualizations**: Recharts v3.8 (analytics dashboards)
- **HTTP Client**: Axios v1.13 with request interceptors for JWT injection
- **Validation**: Zod v3.24 (client-side request/form validation)
- **Notifications**: Sonner v2.0.7 (toast notifications)
- **Icons**: Lucide React v0.548
- **Themes**: next-themes v0.4.6 (dark mode support)
- **PDF Export**: html2canvas v1.4.1 (client-side) + Puppeteer v1.52 (server-side)

### Backend
- **Runtime**: Node.js 18+ with ES Modules
- **Framework**: Express 5 + TypeScript 5
- **Database**: PostgreSQL
- **ORM**: Prisma 6 (type-safe database access, 25+ migrations)
- **Authentication**: JWT (365-day expiry) + bcryptjs (cost factor 12)
- **Validation**: Zod v3.25 (request validation middleware)
- **File Handling**: Multer v2 (multipart uploads)
- **Data Import**: csv-parser + xlsx (CSV/Excel parsing)
- **Automation**: node-cron v4.2 (recurring task scheduling)
- **Email**: Nodemailer v8 (SMTP-based notifications)
- **PDF Generation**: Puppeteer v24 (server-side headless Chrome)
- **HTTP Utilities**: CORS v2.8.5, morgan v1.10 (request logging)
- **Rate Limiting**: express-rate-limit v8 (brute-force protection)

---

## 3. ARCHITECTURE

### Frontend Architecture (Next.js App Router)

**Core Folders:**
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Login, Register, Password Reset
│   ├── dashboard/         # Protected dashboard routes
│   ├── invoices/          # Invoice CRUD + PDF
│   ├── sales/             # Sales management
│   ├── purchases/         # Purchase orders
│   ├── customers/         # Customer CRM
│   ├── suppliers/         # Supplier management
│   ├── products/          # Product catalog
│   ├── inventory/         # Stock tracking
│   ├── warehouses/        # Warehouse management
│   ├── business-profile/  # Company settings
│   ├── api/              # NextAuth routes
│   └── layout.tsx        # Root layout
├── components/            # React components
├── hooks/                # Custom hooks (useInventoryQueries, useBusinessLogo)
├── lib/                  # Utilities (apiClient, apiEndPoints, utils)
├── providers/            # Context providers (Auth, Query, Session)
└── types/               # TypeScript definitions
```

**Authentication Flow:**
1. User logs in via email/password OR OAuth (Google)
2. NextAuth verifies credentials at `/api/auth/callback/credentials`
3. Backend returns JWT token with 365-day expiry
4. Token stored in NextAuth session (httpOnly cookie)
5. Axios interceptor automatically injects `Authorization: Bearer <JWT>` on all requests
6. Backend middleware validates JWT on protected routes
7. NextAuth middleware protects `/dashboard/**` with login redirect

**State Management:**
- **Server State**: TanStack Query (caching, invalidation, stale-time)
- **Client State**: React useState for UI (modals, filters)
- **Persistent State**: localStorage for logo, theme
- **Cross-Tab Sync**: Custom events for real-time updates

### Backend Architecture (Express REST API)

**Layered Flow:**
```
Routes (Express Router)
    ↓
Auth Rate Limiter (if auth endpoint)
    ↓
Request Validation (Zod middleware)
    ↓
JWT Verification (AuthMiddleware)
    ↓
Controllers (HTTP request handling)
    ↓
Services (Business logic)
    ↓
Prisma ORM (Data access)
    ↓
PostgreSQL Database
```

**Route Structure:**
```
/api/
├── auth/              # Login, register, password reset
├── customers/         # Customer CRUD
├── suppliers/         # Supplier CRUD
├── products/          # Product CRUD
├── categories/        # Category CRUD
├── warehouses/        # Warehouse CRUD
├── inventory/         # Stock tracking + adjustments
├── purchases/         # Purchase orders
├── sales/             # Sales records
├── invoices/          # Invoice CRUD + payments
├── payments/          # Payment recording
├── templates/         # Invoice template management
├── recurring-invoices/# Recurring templates
├── business-profile/  # Company settings
├── import/            # Bulk CSV/XLSX import
├── dashboard/         # Analytics endpoints
└── public/invoice/:id # Public invoice view (no auth)
```

**Middleware Stack:**
1. CORS - Cross-origin requests
2. Morgan - HTTP request logging
3. Body Parser - JSON parsing (Express built-in)
4. Auth Rate Limiter - Brute-force protection on /api/auth/*
5. Auth Middleware - JWT verification → extract user_id
6. Validation Middleware - Zod schema validation
7. Error Middleware - Global error handler

**Error Handling:**
```typescript
class AppError extends Error {
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}
// Caught by errorMiddleware, returns standardized JSON
```

---

## 4. COMPLETE FEATURE SET

### A. Authentication & User Management
✅ Email/password registration with bcryptjs (cost 12)
✅ OAuth login (Google) via NextAuth
✅ JWT tokens with 365-day expiry
✅ Forgot password with 30-minute validity crypto token
✅ Password reset with token validation
✅ Profile: view/edit name, email, password
✅ Route protection: NextAuth on frontend, Bearer token on backend

### B. Business Profile
✅ Create/update business information (upsert)
✅ Fields: name, address, phone, email, website, logo, tax ID (GST), currency (INR default)
✅ Toggles: show logo on invoice, show tax number, show payment QR
✅ Business info reflected in invoice PDFs

### C. Customer Management (CRM)
✅ Full CRUD for customers
✅ Fields: name, email, phone, address
✅ Linked to invoices, sales, recurring templates
✅ Analytics: top customers by revenue and order count
✅ Dashboard: total customers, pending payments

### D. Supplier Management
✅ Full CRUD for suppliers
✅ Fields: name, email, phone, address
✅ Linked to purchase orders
✅ Analytics: pending payables per supplier
✅ Dashboard: payable breakdown

### E. Product & Category Management
✅ Full CRUD for products and categories
✅ Product fields: name, SKU (unique per user), barcode (unique globally), selling price, cost price, GST rate (18% default), stock, reorder level, category
✅ Category uniqueness enforced per user
✅ Linked to invoices, sales, purchases, inventory

### F. Warehouse & Inventory Management
✅ Multi-warehouse support (create/read/update)
✅ Inventory records: products per warehouse with quantities
✅ Stock adjustments with reason tracking
✅ Audit trail: stock movements (PURCHASE, SALE, ADJUSTMENT, RETURN, DAMAGE)
✅ Low-stock and out-of-stock alerts based on reorder level
✅ Inventory value calculated (stock_on_hand × cost/selling price)
✅ Dashboard: inventory status, low stock items, total value

### G. Purchase Management
✅ Full CRUD for purchase orders
✅ Fields: supplier, warehouse, date, subtotal, tax, total, notes
✅ Line items: product, quantity, unit cost, tax rate, line total
✅ Payment tracking: total, paid, pending, status (PAID/PARTIALLY_PAID/UNPAID)
✅ Payment methods: CASH, CARD, BANK_TRANSFER, UPI, CHEQUE, OTHER
✅ Auto-inventory update: stock incremented on purchase
✅ Dashboard: pending supplier payables

### H. Sales Management
✅ Full CRUD for sales records
✅ Fields: customer (optional), date, items, subtotal, tax, total, notes
✅ Sale status: DRAFT, COMPLETED, VOID
✅ Payment tracking (similar to purchases)
✅ Auto-inventory sync: optionally create sale + decrement stock on invoice
✅ Dashboard: sales trends, top products

### I. Invoice System (Core Feature)
✅ Create/read/update/delete invoices
✅ Auto-generated sequential invoice numbers (per user)
✅ Invoice statuses: DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE, VOID
✅ Discount support (per invoice)
✅ Line items with automatic tax calculation
✅ Customer linking (optional)
✅ Due date tracking with auto-overdue transition
✅ Payment tracking: multiple partial payments
✅ PDF generation: server-side (Puppeteer), A4 format
✅ Public share link: unauthenticated `/api/public/invoice/:id`
✅ Duplicate invoice: creates new DRAFT copy with new number
✅ Mark as sent: DRAFT → SENT status
✅ Email notification: send invoice via Nodemailer
✅ Inventory sync: validates stock, auto-decrements warehouse inventory

### J. Recurring Invoices
✅ Templates for recurring invoices
✅ Fields: customer, title, items, discount, notes, due_in_days, frequency, interval_count
✅ Frequencies: DAILY, WEEKLY, MONTHLY, YEARLY with intervals
✅ Cron job: runs at midnight, auto-creates invoice drafts
✅ Auto-date advancement: last_run_date updated, next_run_date calculated

### K. Payment Management
✅ Record payments against invoices
✅ Payment fields: invoice, amount, method, provider, transaction_id, reference, paid_at
✅ Auto-update invoice status: PARTIALLY_PAID or PAID
✅ List/filter payments by invoice

### L. Invoice Templates & Customization
✅ System-wide template library
✅ Per-user settings: choose template, enable/disable sections, customize colors
✅ Dynamic section reordering and visibility
✅ User saved templates: save custom layouts for reuse
✅ Design config (JSON): colors, fonts, section order

### M. Bulk Data Import
✅ CSV and XLSX file upload support
✅ Supported types: customers, suppliers, products, categories, warehouses
✅ Column mapping and validation per row
✅ Import statistics: successful/failed counts with errors

### N. Analytics & Reporting
✅ Overview dashboard: aggregated business metrics
✅ Top selling products by quantity (last 30 days)
✅ Category-wise revenue breakdown
✅ Profit trend: monthly rolling 6 months (revenue - purchases - expenses)
✅ Sales analytics: daily/monthly trends, category breakdown
✅ Inventory analytics: total products, low stock, out-of-stock counts
✅ Customer analytics: total, pending payments, top 5 by revenue/orders
✅ Supplier analytics: pending payables per supplier

### O. Dashboard Engine
✅ Overview: revenue, purchases, expenses, receivables, payables, profit (filtered by payment status)
✅ Metrics with % change vs prior period (filtered by payment status: PAID, PARTIALLY_PAID, UNPAID)
✅ Inventory value calculation
✅ Invoice stats: total, paid, pending, overdue counts
✅ Alerts: low stock, overdue invoices, pending payables
✅ Recent activity feed: last 6 sales/purchases
✅ Pending payment rows (top 5)
✅ Sales analytics with 7-day and 30-day charts
✅ Inventory Risk Alerts: product risk status with analysis cards (total products, low stock, out-of-stock, inventory value)
✅ Out-of-stock label: displays "Out of Stock" for items with zero stock instead of "critical"
✅ Inventory status: total, low stock, out-of-stock
✅ Cash flow analysis: inflow/outflow modes (sales, payments, hybrid) - filtered by payment status
✅ Sales forecasting (filtered by payment status)
✅ Profit analytics: daily/monthly profit calculations (filtered by payment status)
✅ Customer Churn Prediction: AI-driven risk classification (High/Medium/Low) based on purchase frequency, recency, and average order value.
✅ Professional Data Visualization: Enhanced charts with linear gradients, custom tooltips, 0-axis baselines, and dynamic timelines.

---

## 5. DATABASE SCHEMA (Prisma)

### Core Models & Relationships

```
User
├── BusinessProfile (1-1)
├── Customers (1-many)
├── Suppliers (1-many)
├── Products (1-many)
│   └── Category (1-many)
├── Warehouses (1-many)
│   └── Inventory (1-many) [warehouse + product composite]
├── Purchases (1-many)
│   └── PurchaseItem (1-many)
├── Sales (1-many)
│   └── SaleItem (1-many)
├── Invoices (1-many)
│   ├── InvoiceItem (1-many)
│   └── Payment (1-many)
├── RecurringInvoiceTemplate (1-many)
├── StockMovement (1-many) [audit trail]
├── PasswordResetToken (1-many)
├── UserTemplate (many-many)
└── UserSavedTemplate (many-many)
```

**Key Enums:**
- `InvoiceStatus`: DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE, VOID
- `PaymentStatus`: PAID, PARTIALLY_PAID, UNPAID
- `PaymentMethod`: CASH, CARD, BANK_TRANSFER, UPI, CHEQUE, OTHER
- `SaleStatus`: DRAFT, COMPLETED, VOID
- `StockReason`: PURCHASE, SALE, ADJUSTMENT, RETURN, DAMAGE
- `RecurrenceFrequency`: DAILY, WEEKLY, MONTHLY, YEARLY

**Constraints & Indexes:**
- SKU unique per user
- Barcode globally unique
- Category name unique per user
- Warehouse + Product composite unique for inventory
- Indexes on user_id, status, due_date, next_run_date
- Cascade delete on user deletion

---

## 6. API ENDPOINTS SUMMARY

### Authentication (`/api/auth`)
- `POST /register` - Register user
- `POST /login` - Login with email/password
- `POST /login/google` - OAuth token exchange
- `POST /forgot-password` - Request reset token
- `POST /reset-password` - Reset password

### Customers, Suppliers, Products, Categories, Warehouses
- `GET /` - List all
- `POST /` - Create
- `GET /:id` - Get details
- `PUT /:id` - Update
- `DELETE /:id` - Delete

### Inventory
- `GET /` - List inventory
- `POST /adjust` - Adjust stock with reason
- `GET /movements` - Stock movement audit trail

### Purchases & Sales
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`

### Invoices
- `GET /` - List (with pagination, filters)
- `POST /` - Create (with optional inventory sync)
- `GET /:id` - Get invoice
- `PUT /:id` - Update
- `DELETE /:id` - Delete
- `POST /:id/mark-sent` - Mark as sent
- `POST /:id/duplicate` - Duplicate invoice
- `GET /:id/pdf` - Download PDF
- `POST /:id/email` - Send to customer

### Payments
- `POST /` - Record payment
- `GET /` - List payments
- `GET /by-invoice/:invoiceId` - Get invoice payments

### Recurring Invoices
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`

### Templates
- `GET /` - List templates
- `GET /user-settings` - Get user customization
- `POST /user-settings` - Save settings
- `POST /saved-templates` - Save custom template
- `GET /saved-templates` - Get user's saved templates

### Business Profile
- `GET /` - Get profile
- `POST /` or `PUT /` - Create/update

### Import
- `POST /` - Upload CSV/XLSX
- `GET /status/:jobId` - Check status

### Dashboard
- `GET /overview` - Metrics and alerts
- `GET /sales-analytics` - Sales trends
- `GET /inventory-analytics` - Stock status
- `GET /customer-analytics` - Customer insights
- `GET /supplier-analytics` - Supplier insights
- `GET /cashflow` - Cash flow analysis
- `GET /forecast` - Sales forecast

### Public
- `GET /invoice/:id` - View invoice without auth

---

## 7. SECURITY FEATURES

✅ Password Security: bcryptjs with cost factor 12
✅ JWT Tokens: 365-day expiry with secure signing
✅ CORS: Configured for frontend domain
✅ Rate Limiting: Brute-force protection on auth endpoints
✅ Request Validation: Zod schemas on all endpoints
✅ Token Injection: Auto JWT header via Axios interceptor
✅ Password Reset: Crypto-random tokens with 30-minute validity
✅ Data Isolation: All queries filtered by user_id
✅ Cascade Delete: User deletion cleans all related data

---

## 8. RECOMMENDED NEW FEATURES TO ADD

### Phase 1: Financial Management (High Priority)
1. **Expense Tracking** - Separate management, categorization, P&L calculation
2. **Multi-Currency Support** - Store prices in multiple currencies, real-time conversion
3. **Tax & GST Management** - Tax-compliant invoices, GSTR reporting
4. **Accounting Integration** - Double-entry bookkeeping, GL, balance sheet, P&L
5. **Invoice Financing** - Early payment options, discounting marketplace

### Phase 2: Advanced Operations (High Priority)
6. **Quotation/Estimate System** - Convert quotes to invoices, expiration tracking
7. **Purchase Requisitions** - Request → Approve → Order workflow, multi-level approval
8. **Delivery Management** - Track shipments, POD, tracking notifications
9. **Subscription/Recurring Billing** - Auto-billing, usage-based billing, dunning
10. **Advanced Inventory** - Serial/batch tracking, expiry dates, barcode scanning, stock transfer

### Phase 3: Team Collaboration (Medium Priority)
11. **Multi-user RBAC** - Roles: Admin, Manager, Sales, Accountant, Viewer
12. **Team Member Management** - Invite, assign roles, activity tracking
13. **Notes & Comments** - Internal notes, @mentions, attachments
14. **Task Management** - Create tasks, assign to team, due dates, email reminders

### Phase 4: Customer Intelligence (Medium Priority)
15. **Customer Portal** - View invoices, history, downloads, payment self-service
16. **Email Integration** - Sync emails, threading, auto-create tasks
17. **Communication Center** - In-app messaging, email, SMS, WhatsApp support
18. **Loyalty & Rewards** - Points system, tiered rewards, referral bonuses

### Phase 5: Advanced Reporting (Medium Priority)
19. **Custom Report Builder** - Drag-and-drop designer, scheduled generation, email delivery
20. **Financial Ratios & KPIs** - Liquidity, profitability, efficiency ratios, custom dashboards
21. **Trend Analysis & Forecasting** - Seasonal analysis, ARIMA forecasting, what-if scenarios

### Phase 6: Mobile & Accessibility (Medium Priority)
22. **Mobile App** - React Native/Flutter, barcode scanning, offline-first, push notifications
23. **WhatsApp Bot** - Invoice delivery, payment reminders, customer inquiries
24. **Accessibility** - WCAG 2.1 AA, screen reader, keyboard navigation, high contrast

### Phase 7: Marketplace & Integrations (Lower Priority)
25. **Integration Marketplace** - Shopify, Amazon, Stripe, PayPal, Google Sheets, Slack, Zapier
26. **Backup & Disaster Recovery** - Automated backups, point-in-time recovery, data export
27. **Compliance & Audit** - Complete audit trail, data retention, GDPR tools, archival

### Phase 8: Automation & AI (Lower Priority)
28. **Intelligent Invoice Processing** - OCR, auto-extraction, duplicate detection
✅ **AI-Powered Insights** - Churn analysis implemented; price optimization and payment prediction planned.
30. **Workflow Automation** - Trigger-based actions, auto-send, auto-follow-ups, smart dunning

---

## 9. IMPLEMENTATION PRIORITY RECOMMENDATION

### Immediate (1-2 months)
- Expense Tracking
- Quotation System
- Multi-user RBAC
- Advanced Inventory (Batches, Expiry)

### Short-term (2-4 months)
- Customer Portal
- Tax & GST Compliance
- Delivery Management
- Custom Reports

### Long-term
- Subscription Billing
- AI Insights & Automation
- Mobile App
- Marketplace Integrations

---

## 10. TECHNICAL RECOMMENDATIONS

**Strengths to Maintain:**
- Type-safe full-stack TypeScript
- Clean layered backend (routes → controllers → services → ORM)
- TanStack Query for robust server-state
- Comprehensive validation with Zod
- Multi-warehouse inventory tracking

**Areas to Enhance:**
1. Add Swagger/OpenAPI documentation
2. Implement Jest + React Testing Library
3. Add Winston logger + Sentry monitoring
4. Consider Bull/Bee-Queue for async jobs
5. Add Redis for performance caching
6. Optimize database indexes for common queries
7. Setup GitHub Actions for CI/CD
8. Consider soft-delete implementation

---

---

## 11. RECENT UPDATES & BUG FIXES (March 2026)

### Dashboard & AI Enhancements (March 2026 - Continued)
✅ **Customer Churn Prediction** - Implemented a sophisticated churn model that analyzes purchase frequency, recency (days since last purchase), and weighted order value to classify customers into risk segments.
✅ **Modernized Cash Flow Summary** - Upgraded visualization with:
  - Linear gradients and smooth monotone curves for data series.
  - Interactive floating tooltips with detailed per-series breakdown.
  - Clean 0-axis baselines and polished coordinate systems.
  - Focused "Month-to-Date" timeline (from 1st of current month).
✅ **High-Density Dashboard Layout** - Eliminated empty space by:
  - Implementing a smart sidebar column for secondary actions and stats.
  - Restructuring the grid into logical groups (Financials, Inventory, CRM).
  - Refactoring cards to automatically stretch and align heights across rows.
✅ **Invoice Statistics Overhaul** - Integrated real-time counts for Total, Paid, Pending, and Overdue invoices into the dashboard header.
✅ **Flexible Card System** - All dashboard components now accept custom classNames and support auto-stretching via flexbox for a perfectly balanced UI.

### Dashboard Fixes
✅ **Fixed Customer Insights & Supplier Overview Loading** - Removed undefined variable references (atRiskCustomers, atRiskSuppliers) that were causing API failures

### Dashboard UI/UX Improvements
✅ **Reorganized Inventory Components** - Moved analysis cards (total products, low stock, out-of-stock, inventory value) from Inventory Overview to Inventory Risk Alerts for better context
✅ **Removed Duplicate Card** - Removed the standalone Inventory Overview card to eliminate redundancy
✅ **Updated Dashboard Layout** - Reorganized cards to fill available space efficiently
  - Customer Insights & Supplier Overview: Now displayed in a 2-column layout
  - Proper space utilization across all dashboard sections

### Inventory Risk Alerts Enhancements
✅ **Out-of-Stock Label** - Products with zero stock now display "Out of Stock" label instead of "critical" badge for better clarity

### Analytics Consistency Updates
✅ **Payment Status Filtering** - Updated all analytics endpoints to consistently filter by payment status (PAID, PARTIALLY_PAID, UNPAID)
  - **Top Dashboard Analytics Cards** - Now calculate metrics based only on payment status, ignoring payment method
  - **Profit Forecast Card** - Updated to filter sales/purchases by payment status for accurate profit calculations
  - **Cash Flow Card** - Updated to filter transactions by payment status for accurate inflow/outflow analysis

### Code Quality Improvements
✅ Database queries in DashboardController now have consistent payment status filtering across:
  - Sales aggregations
  - Purchase aggregations
  - Monthly profit analysis
  - Cash flow calculations
  - Sales forecasting

---

## 12. RECOMMENDED TECH FOR NEW FEATURES

- **RBAC/Permissions**: Casl, AccessControl.js
- **Workflow**: Temporal.io, Apache Airflow
- **Document Gen**: Puppeteer, pdfkit
- **Email Templates**: Handlebars, EJS
- **Barcode Scanning**: jsQR, QuaggaJS
- **WhatsApp**: Twilio WhatsApp Business API
- **Real-time**: Socket.io
- **2FA**: TOTP (authenticator apps)
- **Mobile**: React Native or Flutter
- **AI/ML**: TensorFlow.js, Scikit-learn (Python backend)

---

Use this summary with ChatGPT for detailed feature suggestions, implementation guidance, and architectural decisions.
