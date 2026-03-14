import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import ProfileClient from "@/components/profile/ProfileClient";

const Page = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const name = session.user?.name ?? "User";
  const email = session.user?.email ?? "";

  return (
    <ProfileClient
      initialProfile={{
        id: Number(session.user?.id ?? 0),
        name,
        email,
        provider: session.user?.provider ?? "credentials",
        image: session.user?.image ?? null,
        is_email_verified: false,
      }}
    />
  );
};

export default Page;
