import "multer";

export {};

declare global {
  interface AuthUser {
    id: number;
    ownerUserId: number;
    actorId: string;
    businessId: string;
    sessionVersion: number;
    isEmailVerified: boolean;
    role: "ADMIN" | "WORKER";
    accountType: "OWNER" | "WORKER";
    name: string;
    email: string;
    workerId?: string;
    rememberMe?: boolean;
  }

  interface AdminAuthUser {
    adminId: string;
    role: "SUPER_ADMIN";
    email: string;
  }

  namespace Express {
    interface Request {
      user?: AuthUser;
      admin?: AdminAuthUser;
      file?: Multer.File;
      requestId?: string;
      requestStartedAt?: number;
    }
  }
}
