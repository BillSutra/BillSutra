import type { Request, Response } from "express";
import { getQueueJobStatus } from "../queues/queue.js";
import { sendResponse } from "../utils/sendResponse.js";

const canAccessJobStatus = (
  req: Request,
  jobStatus: NonNullable<Awaited<ReturnType<typeof getQueueJobStatus>>>,
) => {
  const authUser = req.user;
  if (!authUser) {
    return false;
  }

  if (jobStatus.businessId && authUser.businessId === jobStatus.businessId) {
    return true;
  }

  return (
    jobStatus.userId === authUser.id || jobStatus.userId === authUser.ownerUserId
  );
};

class QueueJobsController {
  static async show(req: Request, res: Response) {
    const authUser = req.user;
    if (!authUser) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const jobId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!jobId) {
      return sendResponse(res, 400, { message: "Job id is required" });
    }

    const jobStatus = await getQueueJobStatus(jobId);
    if (!jobStatus || !canAccessJobStatus(req, jobStatus)) {
      return sendResponse(res, 404, { message: "Job not found" });
    }

    return sendResponse(res, 200, { data: jobStatus });
  }
}

export default QueueJobsController;
