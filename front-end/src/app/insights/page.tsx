import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import InsightsClient from "./InsightsClient";

const InsightsPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const token = session?.user?.token?.trim() || undefined;

  if (!session?.user) {
    redirect("/login");
  }

  const name = session?.user?.name?.trim() ?? "";

  return (
    <InsightsClient
      name={name}
      image={session?.user?.image || undefined}
      token={token}
    />
  );
};

export default InsightsPage;
