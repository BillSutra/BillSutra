import { createHash } from "node:crypto";
import type { ExportPayload } from "../../modules/export/export.service.js";
import { enqueueQueueJob } from "../queue.js";
import type { AppQueueContextInput } from "../types.js";

const hashPayload = (payload: ExportPayload) =>
  createHash("sha1").update(JSON.stringify(payload)).digest("hex").slice(0, 16);

export const enqueueExportEmailDelivery = async (params: {
  userId: number;
  actorId?: string;
  businessId?: string | null;
  email: string;
  payload: ExportPayload;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendExportEmail",
    payload: {
      email: params.email,
      payload: params.payload,
    },
    context: {
      businessId: params.businessId ?? null,
      userId: params.userId,
      actorId: params.actorId ?? null,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        resource: params.payload.resource,
        format: params.payload.format,
        scope: params.payload.scope,
        delivery: params.payload.delivery,
        task: "export_email_delivery",
      },
    },
    jobId: `export:${params.userId}:${params.payload.resource}:${params.payload.format}:${hashPayload(
      params.payload,
    )}`,
  });
