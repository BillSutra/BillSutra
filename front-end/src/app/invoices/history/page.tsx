import { getServerSession } from "next-auth";
import {
  authOptions,
  CustomSession,
} from "../../api/auth/[...nextauth]/options";
import InvoicesHistoryClient from "./InvoicesHistoryClient";

const InvoicesHistoryPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <InvoicesHistoryClient
      name={name}
      image={session?.user?.image || undefined}
    />
  );
};

export default InvoicesHistoryPage;
