import { getServerSession } from "next-auth";
import dynamic from "next/dynamic";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";

const InventoryClient = dynamic(() => import("./InventoryClient"), {
  loading: () => (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 text-sm text-muted-foreground">
      Loading inventory workspace...
    </div>
  ),
});

const InventoryPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <InventoryClient name={name} image={session?.user?.image || undefined} />
  );
};

export default InventoryPage;
