import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import SalesClient from "./SalesClient";

const SalesPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return <SalesClient name={name} image={session?.user?.image || undefined} />;
};

export default SalesPage;
