# BillSutra System Architecture Diagram

```mermaid
flowchart LR
  %% Users
  Owner[Business Owner]
  Worker[Worker / Staff]
  Admin[Platform Admin]

  %% Frontend
  subgraph FE[Next.js Frontend]
    Landing[Public Pages]
    Dashboard[Dashboard / Billing / Inventory / Purchases / Sales]
    WorkerPanel[Worker Panel]
    AdminPanel[Admin Console]
    AssistantUI[Assistant / Copilot UI]
    ClientState[React Query + NextAuth + Context Providers + API Client]
  end

  %% Backend
  subgraph API[Express API Server]
    Routes[Routes]
    Middleware[Auth + Validation + Feature Access + Upload Middleware]
    Controllers[Controllers]

    subgraph Modules[Domain Modules]
      InvoiceModule[Invoice Module]
      ImportModule[Import Module]
      ExportModule[Export Module]
      ForecastModule[Forecast Module]
      DemandModule[Inventory Demand Module]
      AssistantModule[Assistant Module]
      CopilotModule[Financial Copilot Module]
    end

    subgraph Services[Shared Services]
      SubscriptionSvc[Subscription Service]
      InventorySvc[Inventory Validation / Billing Sync]
      AnalyticsSvc[Dashboard Analytics Service]
      NotificationSvc[Notification Service]
      StorageSvc[Storage Service]
      MailSvc[Mail Service]
    RealtimeSvc[Dashboard Realtime / SSE / Socket.IO]
    SecureFiles[Secure File Controller]
    end

    Jobs[Cron Jobs + Queue Worker]
  end

  %% Data layer
  subgraph Data[Data & Storage]
    Postgres[(PostgreSQL via Prisma)]
    Uploads[(Local Uploads Storage)]
    Redis[(Redis optional for BullMQ)]
  end

  %% External systems
  subgraph External[External / Sidecar Services]
    FaceService[Python Face Recognition Service]
    Razorpay[Razorpay]
    EmailProvider[SMTP / Resend Provider]
    AddressAPI[Address Lookup Service]
    Sentry[Sentry]
    PostHog[PostHog]
  end

  %% User flows
  Owner --> Landing
  Owner --> Dashboard
  Owner --> AssistantUI
  Worker --> WorkerPanel
  Admin --> AdminPanel

  %% Frontend flow
  Landing --> ClientState
  Dashboard --> ClientState
  WorkerPanel --> ClientState
  AdminPanel --> ClientState
  AssistantUI --> ClientState

  %% Backend flow
  ClientState --> Routes
  Routes --> Middleware
  Middleware --> Controllers

  Controllers --> InvoiceModule
  Controllers --> ImportModule
  Controllers --> ExportModule
  Controllers --> ForecastModule
  Controllers --> DemandModule
  Controllers --> AssistantModule
  Controllers --> CopilotModule

  Controllers --> SubscriptionSvc
  Controllers --> InventorySvc
  Controllers --> AnalyticsSvc
  Controllers --> NotificationSvc
  Controllers --> StorageSvc
  Controllers --> SecureFiles
  Controllers --> MailSvc
  Controllers --> RealtimeSvc
  Jobs --> InvoiceModule
  Jobs --> AnalyticsSvc
  Jobs --> Redis

  %% Data access
  InvoiceModule --> Postgres
  ImportModule --> Postgres
  ExportModule --> Postgres
  ForecastModule --> Postgres
  DemandModule --> Postgres
  AssistantModule --> Postgres
  CopilotModule --> Postgres
  SubscriptionSvc --> Postgres
  InventorySvc --> Postgres
  AnalyticsSvc --> Postgres
  NotificationSvc --> Postgres
  StorageSvc --> Uploads
  SecureFiles --> Uploads

  %% External integrations
  Controllers --> FaceService
  SubscriptionSvc --> Razorpay
  MailSvc --> EmailProvider
  Controllers --> AddressAPI
  ClientState --> PostHog
  Controllers --> Sentry
  ClientState --> Sentry
```

## Notes

- Frontend: Next.js App Router application serving public, owner, worker, and admin experiences; production builds run from the generated standalone server.
- Backend: single Express-based modular monolith with feature-specific controllers, modules, and services.
- Database: PostgreSQL is the source of truth through Prisma.
- Async processing: BullMQ workers are used when TCP Redis queues are enabled; cron jobs handle recurring invoices and cache warming.
- Storage: public assets are served from `/uploads/public`; private uploads/exports are served through authenticated or signed controller paths.
- Sidecar: face recognition runs as a separate Python service invoked by the backend.
