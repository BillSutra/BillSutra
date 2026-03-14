import { getServerSession } from "next-auth";
import {
  authOptions,
  CustomSession,
} from "../../api/auth/[...nextauth]/options";
import WarehouseDetailClient from "./WarehouseDetailClient";

const WarehouseDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";
  const { id } = await params;
  const warehouseId = Number(id);

  return (
    <WarehouseDetailClient
      name={name}
      image={session?.user?.image || undefined}
      warehouseId={warehouseId}
    />
  );
};

export default WarehouseDetailPage;
