import type { Request, Response } from "express";
import type { WorkerRole } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import bcrypt from "bcryptjs";
import {
  ensureBusinessForUser,
  isBusinessTableAvailable,
  isWorkersTableAvailable,
} from "../lib/authSession.js";

const WORKER_MIGRATION_MESSAGE =
  "Worker management requires the latest database migration. Run Prisma migrations and restart the server.";

const normalizeWorkerPhone = (value: string) => value.replace(/\D/g, "");

const ensureWorkerTablesReady = async (res: Response) => {
  const [hasBusinessTable, hasWorkersTable] = await Promise.all([
    isBusinessTableAvailable(),
    isWorkersTableAvailable(),
  ]);

  if (hasBusinessTable && hasWorkersTable) {
    return true;
  }

  sendResponse(res, 503, {
    message: WORKER_MIGRATION_MESSAGE,
  });
  return false;
};

const resolveWorkerRouteBusinessId = async (req: Request) => {
  if (!req.user) {
    return null;
  }

  if (req.user.accountType === "OWNER") {
    const business = await ensureBusinessForUser(
      req.user.ownerUserId,
      req.user.name,
    );
    return business.id;
  }

  return req.user.businessId;
};

class WorkersController {
  static async index(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const workers = await prisma.worker.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    return sendResponse(res, 200, { data: workers });
  }

  static async store(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const { name, email, phone, password } = req.body as {
      name: string;
      email: string;
      phone: string;
      password: string;
    };
    const normalizedPhone = normalizeWorkerPhone(phone);

    const existingWorker = await prisma.worker.findFirst({
      where: {
        OR: [{ email }, { phone: normalizedPhone }],
      },
      select: { id: true, email: true, phone: true },
    });
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser || existingWorker?.email === email) {
      return sendResponse(res, 422, {
        message: "Worker email already registered",
        errors: { email: "Worker email already registered" },
      });
    }

    if (existingWorker?.phone === normalizedPhone) {
      return sendResponse(res, 422, {
        message: "Worker phone number already registered",
        errors: { phone: "Worker phone number already registered" },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const worker = await prisma.worker.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        role: "WORKER" as WorkerRole,
        businessId,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    return sendResponse(res, 201, {
      message: "Worker created successfully",
      data: worker,
    });
  }

  static async update(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);
    const workerId = req.params.id;

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const { name, phone, password } = req.body as {
      name?: string;
      phone?: string;
      password?: string;
    };
    const normalizedPhone = phone ? normalizeWorkerPhone(phone) : undefined;

    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        businessId,
      },
      select: { id: true },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    if (normalizedPhone) {
      const workerWithPhone = await prisma.worker.findFirst({
        where: {
          phone: normalizedPhone,
          NOT: { id: worker.id },
        },
        select: { id: true },
      });

      if (workerWithPhone) {
        return sendResponse(res, 422, {
          message: "Worker phone number already registered",
          errors: { phone: "Worker phone number already registered" },
        });
      }
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: worker.id },
      data: {
        name: name ?? undefined,
        phone: normalizedPhone ?? undefined,
        password: password ? await bcrypt.hash(password, 12) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    return sendResponse(res, 200, {
      message: "Worker updated successfully",
      data: updatedWorker,
    });
  }

  static async destroy(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);
    const workerId = req.params.id;

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (req.user?.workerId && req.user.workerId === workerId) {
      return sendResponse(res, 400, {
        message: "You cannot delete your own worker account",
      });
    }

    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        businessId,
      },
      select: { id: true },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    await prisma.worker.delete({ where: { id: worker.id } });

    return sendResponse(res, 200, { message: "Worker deleted successfully" });
  }
}

export default WorkersController;
