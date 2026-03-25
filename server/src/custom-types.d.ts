import "multer";

export {};

declare global {
  interface AuthUser {
    id: number;
    ownerUserId: number;
    actorId: string;
    businessId: string;
    role: "ADMIN" | "WORKER";
    accountType: "OWNER" | "WORKER";
    name: string;
    email: string;
    workerId?: string;
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
    }
  }
}
