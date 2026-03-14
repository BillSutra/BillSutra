import { getServerSession } from "next-auth";
import {
  authOptions,
  CustomSession,
} from "../../../api/auth/[...nextauth]/options";
import InvoiceDetailClient from "./InvoiceDetailClient";

const InvoiceDetailPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return <InvoiceDetailClient name={name} />;
};

export default InvoiceDetailPage;
