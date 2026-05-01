import { getServerSession } from "next-auth";
import dynamic from "next/dynamic";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";

const SuppliersClient = dynamic(() => import("./SuppliersClient"), {
  loading: () => (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 text-sm text-muted-foreground">
      Loading suppliers workspace...
    </div>
  ),
});

const SuppliersPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <SuppliersClient name={name} image={session?.user?.image || undefined} />
  );
};

export default SuppliersPage;
