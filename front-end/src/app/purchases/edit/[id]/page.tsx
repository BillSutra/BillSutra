import { getServerSession } from "next-auth";
import {
  authOptions,
  CustomSession,
} from "../../../api/auth/[...nextauth]/options";
import PurchasesClient from "../../PurchasesClient";

const EditPurchasePage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const [{ id }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const purchaseId = Number(id);
  const name = (session as CustomSession | null)?.user?.name?.trim() ?? "";

  return (
    <PurchasesClient
      name={name}
      image={(session as CustomSession | null)?.user?.image || undefined}
      mode="edit"
      purchaseId={Number.isFinite(purchaseId) ? purchaseId : undefined}
    />
  );
};

export default EditPurchasePage;
