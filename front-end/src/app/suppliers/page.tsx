import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import SuppliersClient from "./SuppliersClient";

const SuppliersPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <SuppliersClient name={name} image={session?.user?.image || undefined} />
  );
};

export default SuppliersPage;
