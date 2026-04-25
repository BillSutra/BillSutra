import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../../api/auth/[...nextauth]/options";
import PurchasesClient from "../PurchasesClient";

const NewPurchasePage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <PurchasesClient
      name={name}
      image={session?.user?.image || undefined}
      mode="new"
    />
  );
};

export default NewPurchasePage;
