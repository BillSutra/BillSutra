import { Router } from "express";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import ForecastController from "./forecast.controller.js";

const router = Router();

/**
 * GET /api/forecast/sales
 * Query parameters:
 *   - period: 'weekly' | 'monthly' | 'yearly' (default: 'monthly')
 *
 * Response:
 * {
 *   data: {
 *     historical: [{ date: string, revenue: number }, ...],
 *     forecast: [{ date: string, predicted_revenue: number }, ...],
 *     period: 'weekly' | 'monthly' | 'yearly'
 *   }
 * }
 */
router.get("/sales", AuthMiddleware, ForecastController.sales);

export default router;
