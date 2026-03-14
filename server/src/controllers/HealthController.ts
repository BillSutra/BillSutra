import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";

class HealthController {
  static async status(req: Request, res: Response) {
    return sendResponse(res, 200, { status: "ok" });
  }
}

export default HealthController;
