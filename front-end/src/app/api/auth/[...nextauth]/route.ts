import { handleNextAuthRequest } from "../authRouteHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleNextAuthRequest;
export const POST = handleNextAuthRequest;
