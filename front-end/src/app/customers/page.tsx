import { getServerSession } from "next-auth";
import dynamic from "next/dynamic";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";

const CustomersClient = dynamic(() => import("./CustomersClient"), {
  loading: () => (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 text-sm text-muted-foreground">
      Loading customers workspace...
    </div>
  ),
});

const CustomersPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <CustomersClient name={name} image={session?.user?.image || undefined} />
  );
};

export default CustomersPage;
