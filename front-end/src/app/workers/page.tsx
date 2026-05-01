import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import WorkersClient from "./WorkersClient";

const WorkersPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.accountType === "WORKER") {
    redirect("/worker-panel");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const name = session?.user?.name?.trim() ?? "";

  return <WorkersClient name={name} image={session.user.image || undefined} />;
};

export default WorkersPage;
