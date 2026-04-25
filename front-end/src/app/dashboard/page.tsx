import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import DashboardClient from "@/components/dashboard/dashboard-client";

const Page = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const token =
    (process.env.NEXT_PUBLIC_USE_COOKIE_AUTH ??
      process.env.USE_COOKIE_AUTH ??
      "false") === "true"
      ? undefined
      : session?.user?.token?.trim() || undefined;

  if (!session?.user) {
    redirect("/login");
  }

  const name = session?.user?.name?.trim() ?? "";

  return (
    <DashboardClient
      name={name}
      image={session?.user?.image || undefined}
      token={token}
    />
  );
};

export default Page;
