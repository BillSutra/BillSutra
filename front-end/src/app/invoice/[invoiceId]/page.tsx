import { notFound } from "next/navigation";
import PublicInvoicePageClient from "./PublicInvoicePageClient";
import {
  fetchPublicInvoice,
  PublicInvoiceNotFoundError,
} from "@/lib/publicInvoice";

type PublicInvoicePageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

const PublicInvoicePage = async ({ params }: PublicInvoicePageProps) => {
  const { invoiceId } = await params;

  try {
    const invoice = await fetchPublicInvoice(invoiceId);
    return <PublicInvoicePageClient invoice={invoice} />;
  } catch (error) {
    if (error instanceof PublicInvoiceNotFoundError) {
      notFound();
    }

    throw error;
  }
};

export default PublicInvoicePage;
