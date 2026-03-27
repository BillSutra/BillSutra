import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import TemplatesClient from "./TemplatesClient";

const TemplatesPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return <TemplatesClient name={name} image={session?.user?.image || undefined} />;
};

export default TemplatesPage;
