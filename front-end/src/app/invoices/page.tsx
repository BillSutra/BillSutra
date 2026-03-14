import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import InvoicesClient from "./InvoicesClient";

const InvoicesPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return (
    <InvoicesClient name={name} image={session?.user?.image || undefined} />
  );
};

export default InvoicesPage;
