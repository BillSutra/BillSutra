import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import SimpleBillClient from "./SimpleBillClient";

export const metadata = {
  title: "Simple Bill",
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const SimpleBillPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; new?: string }>;
}) => {
  const params = await searchParams;
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const name = session.user.name?.trim() ?? "";

  return (
    <SimpleBillClient
      name={name}
      image={session.user.image || undefined}
      initialInvoiceDate={todayInputValue()}
      initialCustomerName={params.customer?.trim() || ""}
      resetOnLoad={params.new === "1"}
    />
  );
};

export default SimpleBillPage;
