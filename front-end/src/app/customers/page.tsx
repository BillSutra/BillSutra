import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import CustomersClient from "./CustomersClient";

const CustomersPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return (
    <CustomersClient name={name} image={session?.user?.image || undefined} />
  );
};

export default CustomersPage;
