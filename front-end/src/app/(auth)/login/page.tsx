import React from "react";
import { authOptions } from "../../api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import LoginPageContent from "@/components/auth/LoginPageContent";

const Page = async () => {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return <LoginPageContent />;
};

export default Page;
