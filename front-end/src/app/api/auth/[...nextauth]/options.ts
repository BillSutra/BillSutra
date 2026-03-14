import { AuthOptions, ISODateString, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import axios, { AxiosError } from "axios";
import { LOGIN_URL, check_credential } from "@/lib/apiEndPoints";

/* ================= TYPES ================= */

export type CustomSession = {
  user?: CustomUser;
  expires: ISODateString;
};

export type CustomUser = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  provider?: string | null;
  token?: string | null;
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
          const user = authPayload?.user;

          if (!user) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            token: authPayload?.token ?? null,
            provider: "credentials",
          };
        } catch (error) {
          console.error("Credentials login error:", error);
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

          user.id = authPayload?.user?.id?.toString();
          user.token = authPayload?.token ?? authPayload?.user?.token ?? null;
          user.provider = account?.provider;
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

        return false;
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
