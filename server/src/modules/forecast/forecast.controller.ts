import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import { getSalesForecast } from "./forecast.service.js";
import type { ForecastQueryInput } from "./forecast.schema.js";

class ForecastController {
    static async sales(req: Request, res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return sendResponse(res, 401, { message: "Unauthorized" });
        }

        try {
            const query = req.query as unknown as ForecastQueryInput;
            const period = (query?.period ?? "monthly") as "weekly" | "monthly" | "yearly";

            const forecast = await getSalesForecast(userId, period);
            return sendResponse(res, 200, { data: forecast });
        } catch (error) {
            console.error("Forecast error:", error);
            return sendResponse(res, 500, {
                message: error instanceof Error ? error.message : "Forecast generation failed",
            });
        }
    }
}

export default ForecastController;
