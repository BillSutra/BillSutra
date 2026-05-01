import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import WorkerPanelClient from "./WorkerPanelClient";

const Page = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/worker/login");
  }

  if (session.user.accountType !== "WORKER") {
    redirect("/dashboard");
  }

  const name = session?.user?.name?.trim() ?? "Worker";
  const image = session?.user?.image || undefined;

  return <WorkerPanelClient name={name} image={image} />;
};

export default Page;
