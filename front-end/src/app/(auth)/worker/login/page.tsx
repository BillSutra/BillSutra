import React from "react";
import { authOptions } from "../../../api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import WorkerLoginPageContent from "@/components/auth/WorkerLoginPageContent";

const Page = async () => {
  const session = await getServerSession(authOptions);
  if (session?.user?.accountType === "WORKER") {
    redirect("/worker-panel");
  }

  if (session) {
    redirect("/dashboard");
  }

  return <WorkerLoginPageContent />;
};

export default Page;
