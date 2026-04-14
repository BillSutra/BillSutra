import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, type CustomSession } from "../api/auth/[...nextauth]/options";
import NotificationsClient from "./NotificationsClient";

const Page = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <NotificationsClient
      name={session.user.name?.trim() ?? ""}
      image={session.user.image || undefined}
    />
  );
};

export default Page;
