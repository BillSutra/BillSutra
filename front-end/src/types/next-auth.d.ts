import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    provider?: string | null;
    token?: string | null;
    role?: "ADMIN" | "WORKER" | null;
    businessId?: string | null;
    accountType?: "OWNER" | "WORKER" | null;
    workerId?: string | null;
    ownerUserId?: number | null;
  }

  interface Session extends DefaultSession {
    user?: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    user?: import("next-auth").User;
  }
}
