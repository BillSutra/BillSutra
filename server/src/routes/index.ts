import { Router } from "express";
import AuthController from "../controllers/AuthController.js";
import CustomersController from "../controllers/CustomersController.js";
import CategoriesController from "../controllers/CategoriesController.js";
import ProductsController from "../controllers/ProductsController.js";
import PaymentsController from "../controllers/PaymentsController.js";
import ReportsController from "../controllers/ReportsController.js";
import AnalyticsController from "../controllers/AnalyticsController.js";
import DashboardController from "../controllers/DashboardController.js";
import SuppliersController from "../controllers/SuppliersController.js";
import PurchasesController from "../controllers/PurchasesController.js";
import SalesController from "../controllers/SalesController.js";
import WarehousesController from "../controllers/WarehousesController.js";
import InventoriesController from "../controllers/InventoriesController.js";
import UsersController from "../controllers/UsersController.js";
import BusinessProfileController from "../controllers/BusinessProfileController.js";
import TemplatesController from "../controllers/TemplatesController.js";
import UserTemplateController from "../controllers/UserTemplateController.js";
import UserSavedTemplateController from "../controllers/UserSavedTemplateController.js";
import PublicInvoiceController from "../controllers/PublicInvoiceController.js";
import LogoController from "../controllers/LogoController.js";
import WorkersController from "../controllers/WorkersController.js";
import AuthMiddleware from "../middlewares/AuthMIddleware.js";
import AuthSseMiddleware from "../middlewares/AuthSseMiddleware.js";
import RequireAdminMiddleware from "../middlewares/RequireAdminMiddleware.js";
import { logoUploadMiddleware } from "../middlewares/logo.upload.js";
import { authRateLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.js";
import {
  idParamSchema,
  invoiceIdParamSchema,
  authOauthSchema,
  authLoginSchema,
  authRegisterSchema,
  authForgotSchema,
  authResetSchema,
  workerLoginSchema,
  workerCreateSchema,
  workerIdParamSchema,
  workerUpdateSchema,
  userProfileUpdateSchema,
  userPasswordUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  paymentCreateSchema,
  purchaseCreateSchema,
  purchaseUpdateSchema,
  saleCreateSchema,
  saleUpdateSchema,
  warehouseCreateSchema,
  warehouseUpdateSchema,
  inventoryQuerySchema,
  inventoryAdjustSchema,
  businessProfileUpsertSchema,
  userTemplateUpsertSchema,
  userSavedTemplateCreateSchema,
  userSavedTemplateUpdateSchema,
} from "../validations/apiValidations.js";
import invoiceRoutes from "../modules/invoice/invoice.routes.js";
import importRoutes from "../modules/import/import.routes.js";
import forecastRoutes from "../modules/forecast/forecast.routes.js";
import inventoryDemandRoutes from "../modules/inventory-demand/inventoryDemand.routes.js";
import assistantRoutes from "../modules/assistant/assistant.routes.js";

const router = Router();

// Auth routes
router.post(
  "/auth/login",
  authRateLimiter,
  validate({ body: authOauthSchema }),
  AuthController.oauthLogin,
);
router.post(
  "/auth/logincheck",
  validate({ body: authLoginSchema }),
  AuthController.loginCheck,
);
router.post(
  "/auth/register",
  authRateLimiter,
  validate({ body: authRegisterSchema }),
  AuthController.register,
);
router.post(
  "/auth/forgot-password",
  validate({ body: authForgotSchema }),
  AuthController.forgotPassword,
);
router.post(
  "/auth/worker/login",
  validate({ body: workerLoginSchema }),
  AuthController.workerLogin,
);
router.post(
  "/auth/reset-password",
  validate({ body: authResetSchema }),
  AuthController.resetPassword,
);

// Public invoice view
router.get(
  "/public/invoice/:id",
  validate({ params: idParamSchema }),
  PublicInvoiceController.show,
);

// Customers
router.get("/customers", AuthMiddleware, CustomersController.index);
router.get("/clients", AuthMiddleware, CustomersController.index);
router.post(
  "/customers",
  AuthMiddleware,
  validate({ body: customerCreateSchema }),
  CustomersController.store,
);
router.get(
  "/customers/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  CustomersController.show,
);
router.put(
  "/customers/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: customerUpdateSchema }),
  CustomersController.update,
);
router.delete(
  "/customers/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  CustomersController.destroy,
);

// Users
router.get("/users/me", AuthMiddleware, UsersController.me);
router.put(
  "/users/me",
  AuthMiddleware,
  validate({ body: userProfileUpdateSchema }),
  UsersController.updateProfile,
);
router.put(
  "/users/password",
  AuthMiddleware,
  validate({ body: userPasswordUpdateSchema }),
  UsersController.updatePassword,
);
router.delete("/user/data", AuthMiddleware, UsersController.deleteData);
router.delete("/user/account", AuthMiddleware, UsersController.deleteAccount);

// Business profile
router.get(
  "/business-profile",
  AuthMiddleware,
  BusinessProfileController.index,
);
router.post(
  "/business-profile",
  AuthMiddleware,
  validate({ body: businessProfileUpsertSchema }),
  BusinessProfileController.store,
);

// Workers
router.get(
  "/workers",
  AuthMiddleware,
  RequireAdminMiddleware,
  WorkersController.index,
);
router.post(
  "/workers/create",
  AuthMiddleware,
  RequireAdminMiddleware,
  validate({ body: workerCreateSchema }),
  WorkersController.store,
);
router.put(
  "/workers/:id",
  AuthMiddleware,
  RequireAdminMiddleware,
  validate({ params: workerIdParamSchema, body: workerUpdateSchema }),
  WorkersController.update,
);
router.delete(
  "/workers/:id",
  AuthMiddleware,
  RequireAdminMiddleware,
  validate({ params: workerIdParamSchema }),
  WorkersController.destroy,
);

// Logo management
router.get("/logo", AuthMiddleware, LogoController.get);
router.post("/logo", AuthMiddleware, logoUploadMiddleware, LogoController.upload);
router.put("/logo", AuthMiddleware, logoUploadMiddleware, LogoController.update);
router.delete("/logo", AuthMiddleware, LogoController.remove);

// Templates
router.get("/templates", AuthMiddleware, TemplatesController.index);

// User template settings
router.get("/user-template", AuthMiddleware, UserTemplateController.index);
router.post(
  "/user-template",
  AuthMiddleware,
  validate({ body: userTemplateUpsertSchema }),
  UserTemplateController.store,
);

// User saved templates CRUD
router.get(
  "/user-saved-templates",
  AuthMiddleware,
  UserSavedTemplateController.index,
);
router.post(
  "/user-saved-templates",
  AuthMiddleware,
  validate({ body: userSavedTemplateCreateSchema }),
  UserSavedTemplateController.store,
);
router.put(
  "/user-saved-templates/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: userSavedTemplateUpdateSchema }),
  UserSavedTemplateController.update,
);
router.delete(
  "/user-saved-templates/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  UserSavedTemplateController.destroy,
);

// Categories
router.get("/categories", AuthMiddleware, CategoriesController.index);
router.post(
  "/categories",
  AuthMiddleware,
  validate({ body: categoryCreateSchema }),
  CategoriesController.store,
);
router.get(
  "/categories/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  CategoriesController.show,
);
router.put(
  "/categories/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: categoryUpdateSchema }),
  CategoriesController.update,
);
router.delete("/categories/:id", AuthMiddleware, CategoriesController.destroy);

// Products
router.get("/products", AuthMiddleware, ProductsController.index);
router.post(
  "/products",
  AuthMiddleware,
  validate({ body: productCreateSchema }),
  ProductsController.store,
);
router.get(
  "/products/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  ProductsController.show,
);
router.put(
  "/products/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: productUpdateSchema }),
  ProductsController.update,
);
router.delete("/products/:id", AuthMiddleware, ProductsController.destroy);

// Suppliers
router.get("/suppliers", AuthMiddleware, SuppliersController.index);
router.post(
  "/suppliers",
  AuthMiddleware,
  validate({ body: supplierCreateSchema }),
  SuppliersController.store,
);
router.get(
  "/suppliers/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  SuppliersController.show,
);
router.put(
  "/suppliers/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: supplierUpdateSchema }),
  SuppliersController.update,
);
router.delete("/suppliers/:id", AuthMiddleware, SuppliersController.destroy);

// Purchases
router.get("/purchases", AuthMiddleware, PurchasesController.index);
router.post(
  "/purchases",
  AuthMiddleware,
  validate({ body: purchaseCreateSchema }),
  PurchasesController.store,
);
router.get(
  "/purchases/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  PurchasesController.show,
);
router.put(
  "/purchases/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: purchaseUpdateSchema }),
  PurchasesController.update,
);

// Sales
router.get("/sales", AuthMiddleware, SalesController.index);
router.post(
  "/sales",
  AuthMiddleware,
  validate({ body: saleCreateSchema }),
  SalesController.store,
);
router.get(
  "/sales/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  SalesController.show,
);
router.put(
  "/sales/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: saleUpdateSchema }),
  SalesController.update,
);
router.delete(
  "/sales/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  SalesController.destroy,
);

// Warehouses
router.get("/warehouses", AuthMiddleware, WarehousesController.index);
router.post(
  "/warehouses",
  AuthMiddleware,
  validate({ body: warehouseCreateSchema }),
  WarehousesController.store,
);
router.get(
  "/warehouses/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  WarehousesController.show,
);
router.put(
  "/warehouses/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: warehouseUpdateSchema }),
  WarehousesController.update,
);
router.delete("/warehouses/:id", AuthMiddleware, WarehousesController.destroy);

// Inventory
router.get(
  "/inventories",
  AuthMiddleware,
  validate({ query: inventoryQuerySchema }),
  InventoriesController.index,
);
router.post(
  "/inventories/adjust",
  AuthMiddleware,
  validate({ body: inventoryAdjustSchema }),
  InventoriesController.adjust,
);

// Invoices
router.use("/invoices", invoiceRoutes);

// Bulk Import
router.use("/import", importRoutes);

// Forecast
router.use("/forecast", forecastRoutes);

// Inventory Demand Predictions
router.use("/inventory-demand", inventoryDemandRoutes);

// Assistant
router.use("/assistant", assistantRoutes);

// Payments
router.get("/payments", AuthMiddleware, PaymentsController.index);
router.get(
  "/payments/:invoiceId",
  AuthMiddleware,
  validate({ params: invoiceIdParamSchema }),
  PaymentsController.showByInvoice,
);
router.post(
  "/payments",
  AuthMiddleware,
  validate({ body: paymentCreateSchema }),
  PaymentsController.store,
);

// Reports
router.get("/reports/summary", AuthMiddleware, ReportsController.summary);

// Analytics
router.get("/analytics/overview", AuthMiddleware, AnalyticsController.overview);

// Dashboard
router.get("/dashboard/stream", AuthSseMiddleware, DashboardController.stream);
router.get("/dashboard/overview", AuthMiddleware, DashboardController.overview);
router.get("/dashboard/metrics", AuthMiddleware, DashboardController.metrics);
router.get("/dashboard/sales", AuthMiddleware, DashboardController.sales);
router.get(
  "/dashboard/payment-methods",
  AuthMiddleware,
  DashboardController.paymentMethods,
);
router.get(
  "/dashboard/inventory",
  AuthMiddleware,
  DashboardController.inventory,
);
router.get(
  "/dashboard/transactions",
  AuthMiddleware,
  DashboardController.transactions,
);
router.get(
  "/dashboard/customers",
  AuthMiddleware,
  DashboardController.customers,
);
router.get(
  "/dashboard/suppliers",
  AuthMiddleware,
  DashboardController.suppliers,
);
router.get("/dashboard/cashflow", AuthMiddleware, DashboardController.cashflow);
router.get("/dashboard/product-sales", AuthMiddleware, DashboardController.productSales);
router.get("/dashboard/forecast", AuthMiddleware, DashboardController.forecast);

export default router;
