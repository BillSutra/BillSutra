import "multer";

export {};

declare global {
  interface AuthUser {
    id: number;
    name: string;
    email: string;
  }

  namespace Express {
    interface Request {
      user?: AuthUser;
      file?: Multer.File;
    }
  }
}
