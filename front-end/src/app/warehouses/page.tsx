import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import WarehousesClient from "./WarehousesClient";

const WarehousesPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return (
    <WarehousesClient name={name} image={session?.user?.image || undefined} />
  );
};

export default WarehousesPage;
