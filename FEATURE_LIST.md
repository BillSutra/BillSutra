# BillSutra Feature List

This document lists the implemented features currently present in the codebase. It is based on the active frontend pages, backend routes, services, and supporting modules in the repository.

## Required Features (Baseline)

- Role-aware authentication and secure route protection
- Full business operations across invoicing, CRM, sales, purchases, and inventory
- Payment tracking with partial payment and outstanding balance visibility
- Actionable dashboard analytics for financial and operational decisions
- Reliable import/export and admin operations for business continuity

## Updated Features (April 2026)

- Facial recognition flows are now implemented across backend, frontend, and Python service
- Dashboard analytics now use consistent payment-status filtering in key computations
- Inventory risk summaries now distinguish low-stock and out-of-stock counts more accurately
- KPI design and card grouping have been refreshed for clearer financial triage

## 1. Authentication and Access Control

- Email/password registration and login
- Google-based sign-in support
- Password reset flow
- OTP-based login via email
- Passkey registration, listing, login, and removal
- Worker login flow separate from owner/admin login
- Session handling in the frontend with NextAuth
- JWT-protected backend APIs
- Role-aware route protection for workers and admins
- Super-admin login and protected admin area

## 2. Account and User Management

- User profile view and update
- Password change for authenticated users
- Delete business data flow
- Delete account flow
- Confirmation email templates for destructive account actions
- Passkey management from the Settings area

## 3. Business Profile and Branding

- Business profile management
- Business name, address, phone, email, website, and tax details
- Currency configuration
- Logo upload, replace, fetch, and delete
- Invoice branding toggles such as showing logo or tax number

## 4. Customer and Supplier Management

- Customer CRUD
- Supplier CRUD
- Customer ledger view
- Outstanding customer balance visibility
- Open invoice visibility per customer
- Supplier payable visibility through analytics and dashboard views

## 5. Product, Category, and Catalog Management

- Product CRUD
- Category CRUD
- Product search and filtering
- SKU, barcode, pricing, GST/tax rate, stock, and reorder-level management
- Async product selection in invoice and transaction flows

## 6. Warehouse and Inventory Management

- Warehouse CRUD
- Warehouse detail view
- Inventory listing by warehouse
- Manual inventory adjustments
- Inventory movement reasoning support on the backend
- Low-stock and out-of-stock tracking
- Inventory demand alerts endpoint
- Inventory demand prediction endpoint

## 7. Purchases and Sales

- Purchase creation, listing, detail, update, and deletion flow coverage
- Sales creation, listing, detail, update, and deletion
- Payment status tracking for sales and purchases
- Support for multiple payment methods
- Warehouse-linked purchase and sale flows
- Inventory synchronization from purchase and sales activity

## 8. Invoicing

- Invoice creation, list, detail, update, duplicate, and delete
- Auto-generated invoice numbers
- Invoice history view
- Invoice status handling including draft, sent, paid, partial, overdue, and void states
- Multi-line invoice items with tax-aware totals
- Discount support
- Invoice drafts in the frontend workflow
- Invoice PDF generation
- Browser PDF preview flow
- Invoice sharing from the frontend
- Email send flow for invoices
- Reminder email flow for unpaid invoices
- Public invoice page on the frontend
- Public invoice API response on the backend
- Email links that point to the frontend invoice page instead of backend UI routes

## 9. Payments

- Record invoice payments
- Partial-payment handling
- Automatic invoice status progression after payment
- Payment history per invoice
- Payment method labeling and display in the frontend

## 10. Templates and Invoice Customization

- System invoice templates
- User template settings
- User-saved custom templates
- Section enable/disable controls
- Section order customization
- Design configuration per section
- Theme and preview rendering for invoice layouts
- Printable A4 invoice preview stack

## 11. Dashboard and Analytics

- Main dashboard with protected workspace layout
- KPI cards for revenue, purchases, receivables, payables, and profit
- Invoice status counts
- Pending-payment visibility
- Transaction timeline and recent activity views
- Customer analytics panels
- Supplier analytics panels
- Sales charts and product sales charts
- Cash-flow reporting
- Forecast views in the dashboard
- Inventory risk alerts
- SSE-based dashboard stream endpoint for live updates

## 12. Forecasting, Insights, and AI Features

- Dedicated Insights page in the frontend
- Forecast API module
- Dashboard forecast support
- Inventory demand prediction service
- Assistant page in the frontend
- Authenticated assistant query endpoint in the backend

## 13. Data Export and Import

- Export dialog in the frontend
- Export preview before download/email
- Export support for products, customers, and invoices
- Export formats including CSV, XLSX, PDF, and JSON
- Export delivery by direct download or email
- Bulk import module on the backend
- Import support for customers, suppliers, products, categories, and warehouses

## 14. Worker and Team Management

- Worker CRUD for business admins
- Worker directory page in the frontend
- Worker-aware route restrictions
- Worker authentication support in the backend

## 15. Admin Features

- Super-admin login
- Admin dashboard
- Admin business list
- Admin business detail view
- Admin business summary metrics
- Admin worker listing
- Admin business deletion flow

## 16. Public and External-Facing Features

- Landing page with marketing sections
- Pricing page
- Public invoice route in the frontend
- Public invoice JSON endpoint in the backend
- Transactional emails for welcome, password reset, OTP, invoice sent, invoice reminder, export ready, delete-data confirmation, and delete-account confirmation

## 17. Localization and UI Experience

- Language provider infrastructure
- English and Hindi translation files
- Theme provider and theme-aware UI
- Shared not-found page
- Responsive dashboard and workspace layouts

## 18. Background and Operational Features

- Recurring invoice cron job infrastructure in the backend
- Storage provider abstraction for uploaded assets
- Standardized API validation with Zod
- Standardized JSON response helper
- Rate limiting on auth-sensitive routes
- Static serving of uploaded assets

## 19. Current Frontend App Areas

The frontend currently exposes pages for:

- Home
- Login
- Register
- Forgot password
- Reset password
- Worker login
- Dashboard
- Assistant
- Business profile
- Customers
- Inventory
- Insights
- Invoice create/workspace
- Invoice history
- Invoice detail
- Public invoice page
- PDF preview
- Pricing
- Products
- Profile
- Purchases
- Sales
- Settings
- Suppliers
- Templates
- Warehouses
- Workers
- Admin login
- Admin dashboard

## 20. Notes on Scope

- This file focuses on implemented features that are visible in the current repository.
- Some backend capabilities exist without a large dedicated frontend surface yet, such as recurring invoice automation infrastructure and certain prediction endpoints.
- This file intentionally excludes future roadmap ideas and unimplemented recommendations.
