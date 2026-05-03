import type { NextFunction, Request, Response } from "express";
import { buildRbacLogContext, can, type RbacAction } from "../lib/rbac.js";

const RequirePermissionMiddleware = (
  action: RbacAction,
  options?: {
    logEvent?: string;
    message?: string;
  },
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const decision = await can(req.user, action);

    if (!decision.allowed) {
      console.warn(options?.logEvent ?? "[rbac.denied]", {
        ...buildRbacLogContext(req, decision),
        action,
      });

      return res.status(403).json({
        status: 403,
        code: "PERMISSION_DENIED",
        message:
          options?.message ??
          "You don't have permission to perform this action.",
      });
    }

    return next();
  };
};

export default RequirePermissionMiddleware;
