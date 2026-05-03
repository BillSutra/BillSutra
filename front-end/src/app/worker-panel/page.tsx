import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import WorkerPanelClient from "./WorkerPanelClient";

export const dynamic = "force-dynamic";

const AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "accessToken",
  "refreshToken",
];

const decodeJwtPayload = (token: string) => {
  const segment = token.split(".")[1];
  if (!segment) return null;

  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      accountType?: string | null;
      account_type?: string | null;
      role?: string | null;
      name?: string | null;
    };
  } catch {
    return null;
  }
};

const readWorkerCookieSession = async () => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;
  const accessToken = cookieStore.get("accessToken")?.value;
  const payload = decodeJwtPayload(accessToken ?? refreshToken ?? "");
  const accountType = payload?.accountType ?? payload?.account_type;
  const role = payload?.role;

  if (accountType === "WORKER" || role?.toUpperCase() === "WORKER") {
    return {
      hasAuthCookie: true,
      isWorker: true,
      name: payload?.name?.trim() || "Worker",
    };
  }

  return {
    hasAuthCookie: AUTH_COOKIE_NAMES.some((name) => cookieStore.has(name)),
    isWorker: false,
    name: "Worker",
  };
};

const Page = async () => {
  let session: CustomSession | null = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.warn("[worker-panel] nextauth_session_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const cookieSession = await readWorkerCookieSession();

  if (!session?.user && !cookieSession.hasAuthCookie) {
    redirect("/worker/login");
  }

  if (session?.user && session.user.accountType !== "WORKER") {
    redirect("/dashboard");
  }

  if (!session?.user && !cookieSession.isWorker) {
    redirect("/worker/login");
  }

  const name = session?.user?.name?.trim() || cookieSession.name;
  const image = session?.user?.image || undefined;

  return <WorkerPanelClient name={name} image={image} />;
};

export default Page;
