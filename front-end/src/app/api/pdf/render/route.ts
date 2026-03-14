import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { renderPdfWithPlaywright } from "@/lib/pdf/serverPdfRenderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renderPayloadSchema = z.object({
  templateId: z.string().min(1).max(120).nullable().optional(),
  data: z.unknown(),
  enabledSections: z.array(z.string().min(1).max(64)).min(1).max(20),
  sectionOrder: z.array(z.string().min(1).max(64)).max(20).optional(),
  theme: z.unknown(),
  designConfig: z.unknown().optional(),
});

const renderRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(160).optional(),
  payload: renderPayloadSchema,
});

const MAX_PAYLOAD_BYTES = 300_000;

const encodePayload = (value: z.infer<typeof renderPayloadSchema>) => {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
};

const sanitizeFileName = (value?: string) => {
  const fallback = "invoice-preview.pdf";
  if (!value?.trim()) return fallback;
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
};

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { message: "Payload too large" },
        { status: 413 },
      );
    }

    const parsed = renderRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid request payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const origin =
      process.env.PDF_RENDER_ORIGIN?.trim() ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const encodedPayload = encodePayload(parsed.data.payload);
    const targetUrl = `${origin}/pdf/preview?payload=${encodedPayload}`;

    const timeoutMs = Number(process.env.PDF_RENDER_TIMEOUT_MS ?? 60000);
    const retries = Number(process.env.PDF_RENDER_RETRIES ?? 1);
    const retryDelayMs = Number(process.env.PDF_RENDER_RETRY_DELAY_MS ?? 300);

    const pdf = await renderPdfWithPlaywright({
      targetUrl,
      timeoutMs,
      retries,
      retryDelayMs,
    });

    const stablePdf = Uint8Array.from(pdf);
    const pdfBlob = new Blob([stablePdf], { type: "application/pdf" });

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${sanitizeFileName(parsed.data.fileName)}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Unable to render preview PDF",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
