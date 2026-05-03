import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.config.js";
import { getRefreshTokenSecret } from "../lib/authSecrets.js";
import { buildHttpOnlyCookieOptions } from "../lib/cookieSecurity.js";
import {
  clearAuthCookies,
  issueUnifiedAdminCookies,
  parseCookies,
} from "../lib/authCookies.js";
import { sendResponse } from "../utils/sendResponse.js";

const ADMIN_AUTH_COOKIE_NAME = "bill_sutra_admin_session";
const ADMIN_REFRESH_COOKIE_NAME = "bill_sutra_admin_refresh";
const ADMIN_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

const parseOwnerUserId = (ownerId: string) => {
  const parsed = Number.parseInt(ownerId, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const clearAdminAuthCookies = (req: Request | undefined, res: Response) => {
  clearAuthCookies(res, req);
  res.clearCookie(
    ADMIN_AUTH_COOKIE_NAME,
    buildHttpOnlyCookieOptions(req, {
      path: "/",
    }),
  );

  res.clearCookie(
    ADMIN_REFRESH_COOKIE_NAME,
    buildHttpOnlyCookieOptions(req, {
      path: "/",
    }),
  );
};

const issueAdminSession = (req: Request, res: Response, authUser: AdminAuthUser) => {
  clearAdminAuthCookies(req, res);
  const issued = issueUnifiedAdminCookies(req, res, {
    id: authUser.adminId,
    email: authUser.email,
    role: "super_admin",
  });

  return {
    user: authUser,
    token: `Bearer ${issued.accessToken}`,
    expiresAt: issued.accessTokenExpiresAt,
  };
};

const verifyRefreshToken = (token: string) => {
  const decoded = jwt.verify(token, getRefreshTokenSecret());
  if (!decoded || typeof decoded === "string") {
    return null;
  }

  const payload = decoded as Record<string, unknown>;
  const adminId =
    typeof payload.adminId === "string" ? payload.adminId.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const normalizedRole =
    typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "";
  const role =
    normalizedRole === "super_admin" || payload.role === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : undefined;
  const tokenType =
    typeof payload.token_type === "string" ? payload.token_type : "";

  if (!adminId || !email || role !== "SUPER_ADMIN") {
    return null;
  }

  if (tokenType && tokenType !== "refresh_v1" && tokenType !== "admin_refresh_v1") {
    return null;
  }

  return {
    adminId,
    email,
    role,
  } satisfies AdminAuthUser;
};

class AdminController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return sendResponse(res, 422, {
        message: "Invalid admin credentials",
        errors: { email: "Invalid admin credentials" },
      });
    }

    const passwordValid = await bcrypt.compare(password, admin.password);

    if (!passwordValid) {
      return sendResponse(res, 422, {
        message: "Invalid admin credentials",
        errors: { email: "Invalid admin credentials" },
      });
    }

    const authUser: AdminAuthUser = {
      adminId: admin.id,
      email: admin.email,
      role: "SUPER_ADMIN",
    };
    const session = issueAdminSession(req, res, authUser);

    return sendResponse(res, 200, {
      message: "Admin login successful",
      data: session,
    });
  }

  static session(req: Request, res: Response) {
    return sendResponse(res, 200, {
      data: {
        user: req.admin ?? null,
        expiresAt: Date.now() + ADMIN_ACCESS_TOKEN_TTL_MS,
      },
    });
  }

  static async refresh(req: Request, res: Response) {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken =
      cookies.get("refreshToken") ??
      cookies.get(ADMIN_REFRESH_COOKIE_NAME) ??
      null;

    if (!refreshToken) {
      clearAdminAuthCookies(req, res);
      return sendResponse(res, 401, {
        message: "Unauthorized",
      });
    }

    try {
      const authUser = verifyRefreshToken(refreshToken);
      if (!authUser) {
        clearAdminAuthCookies(req, res);
        return sendResponse(res, 401, {
          message: "Unauthorized",
        });
      }

      const admin = await prisma.admin.findUnique({
        where: { id: authUser.adminId },
        select: {
          id: true,
          email: true,
        },
      });

      if (!admin || admin.email !== authUser.email) {
        clearAdminAuthCookies(req, res);
        return sendResponse(res, 401, {
          message: "Unauthorized",
        });
      }

      const session = issueAdminSession(req, res, authUser);
      return sendResponse(res, 200, {
        message: "Admin session refreshed",
        data: session,
      });
    } catch {
      clearAdminAuthCookies(req, res);
      return sendResponse(res, 401, {
        message: "Unauthorized",
      });
    }
  }

  static async logout(req: Request, res: Response) {
    clearAdminAuthCookies(req, res);
    return sendResponse(res, 200, {
      message: "Admin logged out successfully",
    });
  }

  static async listBusinesses(_req: Request, res: Response) {
    const businesses = await prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        _count: {
          select: { workers: true },
        },
      },
    });

    const ownerIds = businesses
      .map((business) => parseOwnerUserId(business.ownerId))
      .filter((ownerId): ownerId is number => ownerId !== null);

    const owners = ownerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const ownerMap = new Map(owners.map((owner) => [String(owner.id), owner]));

    return sendResponse(res, 200, {
      data: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        ownerId: business.ownerId,
        ownerName: ownerMap.get(business.ownerId)?.name ?? null,
        ownerEmail: ownerMap.get(business.ownerId)?.email ?? null,
        createdAt: business.createdAt,
        workerCount: business._count.workers,
      })),
    });
  }

  static async summary(_req: Request, res: Response) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [businesses, workers] = await Promise.all([
      prisma.business.findMany({
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
          _count: {
            select: { workers: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.worker.findMany({
        select: {
          role: true,
          createdAt: true,
        },
      }),
    ]);

    const totalBusinesses = businesses.length;
    const totalWorkers = workers.length;
    const zeroWorkerBusinesses = businesses.filter(
      (business) => business._count.workers === 0,
    ).length;
    const activeBusinesses = businesses.filter(
      (business) => business._count.workers > 0,
    ).length;
    const businessesCreatedLast7Days = businesses.filter(
      (business) => business.createdAt >= sevenDaysAgo,
    ).length;
    const workersCreatedLast7Days = workers.filter(
      (worker) => worker.createdAt >= sevenDaysAgo,
    ).length;
    const adminWorkers = workers.filter(
      (worker) => worker.role === "ADMIN",
    ).length;

    return sendResponse(res, 200, {
      data: {
        totals: {
          totalBusinesses,
          totalWorkers,
          activeBusinesses,
          zeroWorkerBusinesses,
          businessesCreatedLast7Days,
          workersCreatedLast7Days,
          adminWorkers,
          averageWorkersPerBusiness:
            totalBusinesses === 0
              ? 0
              : Number((totalWorkers / totalBusinesses).toFixed(1)),
        },
        topBusinessesByWorkers: businesses
          .map((business) => ({
            id: business.id,
            name: business.name,
            ownerId: business.ownerId,
            createdAt: business.createdAt,
            workerCount: business._count.workers,
          }))
          .sort((left, right) => right.workerCount - left.workerCount)
          .slice(0, 5),
      },
    });
  }

  static async showBusiness(req: Request, res: Response) {
    const businessId = readRouteParam(req.params.id);
    if (!businessId) {
      return sendResponse(res, 422, { message: "Business id is required" });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        workers: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!business) {
      return sendResponse(res, 404, { message: "Business not found" });
    }

    const ownerUserId = parseOwnerUserId(business.ownerId);
    const [owner, businessProfile, stats] = await Promise.all([
      ownerUserId
        ? prisma.user.findUnique({
            where: { id: ownerUserId },
            select: {
              id: true,
              name: true,
              email: true,
              provider: true,
              created_at: true,
            },
          })
        : Promise.resolve(null),
      ownerUserId
        ? prisma.businessProfile.findUnique({
            where: { user_id: ownerUserId },
            select: {
              business_name: true,
              phone: true,
              email: true,
              website: true,
              address: true,
              currency: true,
            },
          })
        : Promise.resolve(null),
      ownerUserId
        ? prisma.$transaction([
            prisma.sale.count({ where: { user_id: ownerUserId } }),
            prisma.invoice.count({ where: { user_id: ownerUserId } }),
            prisma.purchase.count({ where: { user_id: ownerUserId } }),
            prisma.product.count({ where: { user_id: ownerUserId } }),
            prisma.customer.count({ where: { user_id: ownerUserId } }),
            prisma.supplier.count({ where: { user_id: ownerUserId } }),
          ])
        : Promise.resolve([0, 0, 0, 0, 0, 0] as const),
    ]);

    return sendResponse(res, 200, {
      data: {
        id: business.id,
        name: business.name,
        ownerId: business.ownerId,
        createdAt: business.createdAt,
        owner,
        businessProfile,
        workers: business.workers,
        stats: {
          workerCount: business.workers.length,
          salesCount: stats[0],
          invoiceCount: stats[1],
          purchaseCount: stats[2],
          productCount: stats[3],
          customerCount: stats[4],
          supplierCount: stats[5],
        },
      },
    });
  }

  static async deleteBusiness(req: Request, res: Response) {
    const businessId = readRouteParam(req.params.id);
    if (!businessId) {
      return sendResponse(res, 422, { message: "Business id is required" });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    });

    if (!business) {
      return sendResponse(res, 404, { message: "Business not found" });
    }

    const ownerUserId = parseOwnerUserId(business.ownerId);

    await prisma.$transaction(async (tx) => {
      await tx.worker.deleteMany({
        where: { businessId: business.id },
      });

      if (ownerUserId) {
        await tx.passwordResetToken.deleteMany({
          where: { user_id: ownerUserId },
        });
        await tx.recurringInvoiceTemplate.deleteMany({
          where: { user_id: ownerUserId },
        });
        await tx.invoice.deleteMany({ where: { user_id: ownerUserId } });
        await tx.sale.deleteMany({ where: { user_id: ownerUserId } });
        await tx.purchase.deleteMany({ where: { user_id: ownerUserId } });
        await tx.warehouse.deleteMany({ where: { user_id: ownerUserId } });
        await tx.product.deleteMany({ where: { user_id: ownerUserId } });
        await tx.category.deleteMany({ where: { user_id: ownerUserId } });
        await tx.supplier.deleteMany({ where: { user_id: ownerUserId } });
        await tx.customer.deleteMany({ where: { user_id: ownerUserId } });
        await tx.businessProfile.deleteMany({
          where: { user_id: ownerUserId },
        });
        await tx.userTemplate.deleteMany({ where: { user_id: ownerUserId } });
        await tx.userSavedTemplate.deleteMany({
          where: { user_id: ownerUserId },
        });
        await tx.user.deleteMany({ where: { id: ownerUserId } });
      }

      await tx.business.delete({ where: { id: business.id } });
    });

    return sendResponse(res, 200, {
      message: "Business deleted successfully",
    });
  }

  static async listWorkers(_req: Request, res: Response) {
    const workers = await prisma.worker.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
        business: {
          select: {
            name: true,
            ownerId: true,
          },
        },
      },
    });

    return sendResponse(res, 200, { data: workers });
  }
}

export default AdminController;
