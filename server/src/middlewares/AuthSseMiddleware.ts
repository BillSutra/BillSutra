import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const normalizeToken = (raw?: unknown) => {
  if (!raw) return null;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice("bearer ".length).trim();
  }
  return trimmed;
};

const AuthSseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const headerToken = req.headers?.authorization?.split(" ")[1];
  const queryToken = normalizeToken(req.query.token);
  const token = normalizeToken(headerToken ?? queryToken ?? undefined);

  if (!token) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    (
      err: jwt.VerifyErrors | null,
      decoded: string | jwt.JwtPayload | undefined,
    ) => {
      if (err) {
        res.status(401).json({ status: 401, message: "Unauthorized" });
        return;
      }

      req.user = decoded as AuthUser;
      next();
    },
  );
};

export default AuthSseMiddleware;
