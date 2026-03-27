import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import BusinessProfileClient from "./BusinessProfileClient";

const BusinessProfilePage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <BusinessProfileClient name={name} image={session?.user?.image || undefined} />
  );
};

export default BusinessProfilePage;
