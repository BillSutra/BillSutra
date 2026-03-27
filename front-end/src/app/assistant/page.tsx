import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import AssistantClient from "./AssistantClient";

const AssistantPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const token = session?.user?.token?.trim() || undefined;

  if (!session?.user) {
    redirect("/login");
  }

  const name = session?.user?.name?.trim() ?? "";

  return (
    <AssistantClient
      name={name}
      image={session?.user?.image || undefined}
      token={token}
    />
  );
};

export default AssistantPage;
