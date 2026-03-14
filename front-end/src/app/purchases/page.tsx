import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import PurchasesClient from "./PurchasesClient";

const PurchasesPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return (
    <PurchasesClient name={name} image={session?.user?.image || undefined} />
  );
};

export default PurchasesPage;
