import { AuthOptions, ISODateString, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import axios, { AxiosError } from "axios";
import {
  API_URL,
  LOGIN_URL,
  WORKER_LOGIN_URL,
  check_credential,
} from "@/lib/apiEndPoints";

/* ================= TYPES ================= */

export type CustomSession = {
  user?: CustomUser;
  expires: ISODateString;
};

export type CustomUser = User & {
  id: string;
  provider?: string | null;
  token?: string | null;
  is_email_verified?: boolean | null;
  role?: "ADMIN" | "WORKER" | null;
  businessId?: string | null;
  accountType?: "OWNER" | "WORKER" | null;
  workerId?: string | null;
  ownerUserId?: number | null;
};

type AuthPayloadUser = {
  id?: number | string | null;
  name?: string | null;
  email?: string | null;
  provider?: string | null;
  image?: string | null;
  is_email_verified?: boolean | null;
  role?: "ADMIN" | "WORKER" | null;
  businessId?: string | null;
  accountType?: "OWNER" | "WORKER" | null;
  account_type?: "OWNER" | "WORKER" | null;
  workerId?: string | null;
  worker_id?: string | null;
  ownerUserId?: number | null;
  owner_user_id?: number | null;
};

type AuthPayload = {
  user?: AuthPayloadUser;
  token?: string | null;
};

const mapAuthPayloadToUser = (
  authPayload: AuthPayload | undefined,
  fallbackProvider: string,
  options?: {
    includeBootstrapToken?: boolean;
  },
): CustomUser | null => {
  const user = authPayload?.user;
  if (!user) return null;

  const resolvedId =
    user.id !== undefined && user.id !== null
      ? String(user.id)
      : (user.workerId ?? user.worker_id ?? null);
  if (!resolvedId) return null;

  return {
    id: resolvedId,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    provider: user.provider ?? fallbackProvider,
    token: options?.includeBootstrapToken ? authPayload?.token ?? null : null,
    is_email_verified: user.is_email_verified ?? null,
    role: user.role ?? null,
    businessId: user.businessId ?? null,
    accountType: user.accountType ?? user.account_type ?? null,
    workerId: user.workerId ?? user.worker_id ?? null,
    ownerUserId:
      typeof user.ownerUserId === "number"
        ? user.ownerUserId
        : typeof user.owner_user_id === "number"
          ? user.owner_user_id
          : null,
  };
};

/* ================= AUTH OPTIONS ================= */

export const authOptions: AuthOptions = {
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },

  providers: [
    /* ================= GOOGLE LOGIN ================= */

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    /* ================= EMAIL / PASSWORD LOGIN ================= */

    CredentialsProvider({
      name: "Credentials",

      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        try {
          const payload = {
            email: credentials?.email,
            password: credentials?.password,
          };

          const { data } = await axios.post(check_credential, payload);
          const authPayload = data?.data ?? data;
          const user = mapAuthPayloadToUser(authPayload, "credentials");

          if (!user) return null;

          return user;
        } catch (error) {
          console.error("Credentials login error:", error);
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "worker-credentials",
      name: "Worker Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const payload = {
            email: credentials?.email,
            password: credentials?.password,
          };

          const { data } = await axios.post(WORKER_LOGIN_URL, payload);
          const authPayload = data?.data ?? data;
          return mapAuthPayloadToUser(authPayload, "worker");
        } catch (error) {
          console.error("Worker credentials login error:", error);
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "auth-token",
      name: "Auth Token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const rawToken = credentials?.token?.trim();
        if (!rawToken) return null;

        const bearerToken = rawToken.startsWith("Bearer ")
          ? rawToken
          : `Bearer ${rawToken}`;

        try {
          const { data } = await axios.get(`${API_URL}/users/me`, {
            headers: {
              Authorization: bearerToken,
            },
          });

          return mapAuthPayloadToUser(
            {
              user: data?.data as AuthPayloadUser | undefined,
              token: bearerToken,
            },
            "token",
            {
              includeBootstrapToken: false,
            },
          );
        } catch (error) {
          console.error("Token login error:", error);
          return null;
        }
      },
    }),
  ],

  /* ================= CALLBACKS ================= */

  callbacks: {
    async signIn({
      user,
      account,
    }: {
      user: CustomUser;
      account: Account | null;
    }) {
      try {
        /* Run backend login ONLY for Google */
        if (account?.provider === "google") {
          const payload = {
            email: user.email,
            name: user.name,
            oauth_id: account?.providerAccountId,
            provider: account?.provider,
            image: user.image,
          };

          const { data } = await axios.post(LOGIN_URL, payload);
          const authPayload = data?.data ?? data;
          const mappedUser = mapAuthPayloadToUser(
            authPayload,
            account?.provider ?? "google",
            {
              includeBootstrapToken: true,
            },
          );

          if (!mappedUser) {
            return "/login?error=BackendProfileMapping";
          }

          user.id = mappedUser.id;
          user.name = mappedUser.name;
          user.email = mappedUser.email;
          user.image = mappedUser.image;
          user.token = mappedUser.token;
          user.provider = mappedUser.provider;
          user.role = mappedUser.role;
          user.is_email_verified = mappedUser.is_email_verified;
          user.businessId = mappedUser.businessId;
          user.accountType = mappedUser.accountType;
          user.workerId = mappedUser.workerId;
          user.ownerUserId = mappedUser.ownerUserId;
        }

        return true;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(
            "Backend Login Error:",
            error.response?.data || error.message,
          );
        } else {
          console.error("Unknown error:", error);
        }

        return "/login?error=BackendAuth";
      }
    },

    async jwt({ token, user }: { token: JWT; user?: CustomUser }) {
      if (user) {
        token.user = user;
      }

      return token;
    },

    async session({
      session,
      token,
    }: {
      session: CustomSession;
      token: JWT;
      user: User;
    }) {
      session.user = token.user as CustomUser;

      return session;
    },
  },

  /* ================= SESSION ================= */

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
