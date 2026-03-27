import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import InventoryClient from "./InventoryClient";

const InventoryPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <InventoryClient name={name} image={session?.user?.image || undefined} />
  );
};

export default InventoryPage;
