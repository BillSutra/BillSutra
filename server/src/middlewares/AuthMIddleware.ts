import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers?.authorization;

  if (!authHeader) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    (
      err: jwt.VerifyErrors | null,
      decoded: string | jwt.JwtPayload | undefined
    ) => {
      if (err) {
        res.status(401).json({ status: 401, message: "Unauthorized" });
        return;
      }

      req.user = decoded as AuthUser;

      next();
    }
  );
};

export default AuthMiddleware;