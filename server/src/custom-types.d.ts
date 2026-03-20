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

  namespace Express {
    interface Request {
      user?: AuthUser;
      file?: Multer.File;
    }
  }
}
