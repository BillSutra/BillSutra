import { createHash } from "node:crypto";
import type { ExportPayload } from "../../modules/export/export.service.js";
import { enqueueDefaultJob } from "../queue.js";

const hashPayload = (payload: ExportPayload) =>
  createHash("sha1").update(JSON.stringify(payload)).digest("hex").slice(0, 16);

export const enqueueExportEmailDelivery = async (params: {
  userId: number;
  actorId?: string;
  email: string;
  payload: ExportPayload;
}) =>
  enqueueDefaultJob({
    jobName: "sendExportEmail",
    data: params,
    jobId: `export:${params.userId}:${params.payload.resource}:${params.payload.format}:${hashPayload(
      params.payload,
    )}`,
  });
