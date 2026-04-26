import type { Request, Response } from "express";
import prisma from "../../config/db.config.js";
import jwt from "jsonwebtoken";
interface LoginPayloadType {
  name: string;
  email: string;
  provider: string;
  oauth_id: string;
  image?: string;
}
class AuthController {
  // Authentication related methods will go here
  static async login(req: Request, res: Response) {
    try {
      const body: LoginPayloadType = req.body;
      if (!body?.email) {
        return res.status(400).json({ message: "Email is required" });
      }
      // Use email as unique identifier (schema enforces unique email)
      const findUser = await prisma.user.upsert({
        where: { email: body.email },
        update: {
          name: body.name,
          provider: body.provider,
          oauth_id: body.oauth_id,
          image: body.image,
        },
        create: {
          name: body.name,
          email: body.email,
          provider: body.provider,
          oauth_id: body.oauth_id,
          image: body.image,
        },
      });
      const JWTPayload = {
        name: body.name,
        email: body.email,
        id: findUser.id,
      };
      const token = jwt.sign(JWTPayload, process.env.JWT_SECRET as string, {
        expiresIn: "15m",
      });
      res.status(200).json({
        message: "Login Successful",
        user: findUser,
        token: `Bearer ${token}`,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    } catch (error) {
      res.status(500).send("Internal Server Error");
    }
  }
}

export default AuthController;
