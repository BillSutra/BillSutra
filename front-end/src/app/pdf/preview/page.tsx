import PdfPreviewClient from "./PdfPreviewClient";

const PdfPreviewPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ payload?: string }>;
}) => {
  const params = await searchParams;
  const encodedPayload = params.payload ?? "";

  return <PdfPreviewClient encodedPayload={encodedPayload} />;
};

export default PdfPreviewPage;
