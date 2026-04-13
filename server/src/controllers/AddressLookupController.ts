import type { Request, Response } from "express";
import {
  getPincodeLookupHealth,
  lookupIndianPincode,
} from "../lib/pincodeLookup.js";
import { sendResponse } from "../utils/sendResponse.js";

class AddressLookupController {
  static health(_req: Request, res: Response) {
    return sendResponse(res, 200, {
      data: getPincodeLookupHealth(),
    });
  }

  static async lookupPincode(req: Request, res: Response) {
    const pincode = String(req.params.pincode ?? "");
    const lookup = await lookupIndianPincode(pincode);

    if (!lookup) {
      return sendResponse(res, 404, {
        message: "Pincode not found.",
      });
    }

    return sendResponse(res, 200, {
      data: lookup,
    });
  }
}

export default AddressLookupController;
