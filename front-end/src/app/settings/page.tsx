import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import SettingsControlCenter from "./SettingsControlCenter";

const SettingsPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <SettingsControlCenter
      name={name}
      image={session?.user?.image || undefined}
    />
  );
};

export default SettingsPage;
