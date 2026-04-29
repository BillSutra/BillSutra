import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { ACCESS_TOKEN_COOKIE_NAME, parseCookies } from "../lib/authCookies.js";
import { getAccessTokenSecret } from "../lib/authSecrets.js";
import {
  hasSupportedAccessTokenType,
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";
import { getAllowedCorsOrigins, isAllowedCorsOrigin } from "../lib/corsOrigins.js";
import { getRedisClient } from "../redis/redisClient.js";

type RealtimeEventPayload = {
  userId: number;
  source?: string;
  at: number;
};

type InvoiceUpdatedPayload = {
  userId: number;
  invoiceId: number;
  status: string;
  totalPaid: number;
  computedStatus?: string;
  source?: string;
};

type PaymentAddedPayload = {
  userId: number;
  invoiceId: number;
  paymentId: number;
  amount: number;
  totalPaid: number;
  status: string;
  computedStatus?: string;
};

type NotificationRealtimePayload = {
  userId: number;
  notification: {
    id: string;
    businessId: string;
    type:
      | "payment"
      | "inventory"
      | "customer"
      | "subscription"
      | "worker"
      | "security"
      | "system";
    title: string;
    message: string;
    actionUrl: string;
    priority: "critical" | "warning" | "info" | "success";
    isRead: boolean;
    createdAt: string;
  };
};

type NotificationDeletedPayload = {
  userId: number;
  notificationId: string;
};

type AuthenticatedSocket = Socket & {
  data: {
    authUser?: AuthUser;
  };
};

let io: SocketIOServer | null = null;
const SOCKET_HANDSHAKE_WINDOW_MS = 5 * 60 * 1000;
const SOCKET_HANDSHAKE_LIMIT = 60;

const normalizeToken = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, "").trim() || null;
  }
  return trimmed;
};

const resolveSocketToken = (socket: Socket) => {
  const authPayload =
    typeof socket.handshake.auth === "object" && socket.handshake.auth
      ? socket.handshake.auth
      : {};

  const authToken =
    typeof (authPayload as { token?: unknown }).token === "string"
      ? (authPayload as { token?: string }).token
      : typeof (authPayload as { accessToken?: unknown }).accessToken === "string"
        ? (authPayload as { accessToken?: string }).accessToken
        : null;

  if (authToken) {
    return normalizeToken(authToken);
  }

  const headerAuth = socket.handshake.headers.authorization;
  if (typeof headerAuth === "string") {
    return normalizeToken(headerAuth);
  }

  const cookieToken =
    parseCookies(socket.handshake.headers.cookie).get(ACCESS_TOKEN_COOKIE_NAME) ??
    null;

  return normalizeToken(cookieToken);
};

const getSocketClientIp = (socket: Socket) => {
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || socket.handshake.address;
  }

  return socket.handshake.address;
};

const throttleSocketHandshake = async (socket: Socket) => {
  const client = await getRedisClient();
  if (!client) {
    return true;
  }

  const key = `rate-limit:socket-handshake:${getSocketClientIp(socket)}`;
  const current = await client.incr(key);
  if (current === 1) {
    await client.pexpire(key, SOCKET_HANDSHAKE_WINDOW_MS);
  }

  return current <= SOCKET_HANDSHAKE_LIMIT;
};

const authenticateSocket = async (socket: AuthenticatedSocket) => {
  const requestOrigin = socket.handshake.headers.origin ?? null;
  if (!isAllowedCorsOrigin(requestOrigin)) {
    throw new Error("origin_not_allowed");
  }

  const handshakeAllowed = await throttleSocketHandshake(socket);
  if (!handshakeAllowed) {
    throw new Error("rate_limited");
  }

  const token = resolveSocketToken(socket);
  if (!token) {
    throw new Error("missing_token");
  }

  const decoded = jwt.verify(token, getAccessTokenSecret());
  if (!hasSupportedAccessTokenType(decoded)) {
    throw new Error("invalid_token_type");
  }
  let authUser: AuthUser | null;

  try {
    authUser = await resolveAuthUserFromDecoded(decoded);
  } catch {
    throw new Error("service_unavailable");
  }

  if (!authUser) {
    throw new Error("invalid_user");
  }

  let latestSessionVersion: number | null;
  try {
    latestSessionVersion = await getUserSessionVersionIfAvailable(
      authUser.ownerUserId,
    );
  } catch {
    throw new Error("service_unavailable");
  }

  if (
    latestSessionVersion !== null &&
    latestSessionVersion !== authUser.sessionVersion
  ) {
    throw new Error("session_expired");
  }

  socket.data.authUser = authUser;
  socket.join(`user_${authUser.ownerUserId}`);
  console.info("[socket] client connected", {
    socketId: socket.id,
    ownerUserId: authUser.ownerUserId,
    actorId: authUser.actorId,
  });
};

export const initRealtimeSocketServer = (server: HttpServer) => {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: getAllowedCorsOrigins(),
      credentials: true,
      methods: ["GET", "POST"],
    },
    allowEIO3: false,
    maxHttpBufferSize: 1_000_000,
    connectTimeout: 10_000,
    cookie: false,
  });

  io.use((socket, next) => {
    void authenticateSocket(socket as AuthenticatedSocket)
      .then(() => next())
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const serviceUnavailable = errorMessage === "service_unavailable";
        const rateLimited = errorMessage === "rate_limited";
        console.warn("[socket] authentication failed", {
          socketId: socket.id,
          error: errorMessage,
          origin: socket.handshake.headers.origin ?? null,
        });
        next(
          new Error(
            serviceUnavailable
              ? "ServiceUnavailable"
              : rateLimited
                ? "RateLimited"
                : "Unauthorized",
          ),
        );
      });
  });

  io.on("connection", (socket) => {
    socket.emit("connected", { at: Date.now() });

    socket.on("disconnect", (reason) => {
      const authUser = (socket as AuthenticatedSocket).data.authUser;
      console.info("[socket] client disconnected", {
        socketId: socket.id,
        ownerUserId: authUser?.ownerUserId ?? null,
        reason,
      });
    });
  });

  return io;
};

export const shutdownRealtimeSocketServer = async () => {
  if (!io) {
    return;
  }

  const activeServer = io;
  io = null;

  await new Promise<void>((resolve) => {
    activeServer.close(() => resolve());
  });
};

const emitToUserRoom = <T extends object>(
  roomUserId: number,
  event: string,
  payload: T,
) => {
  if (!io) {
    return;
  }

  io.to(`user_${roomUserId}`).emit(event, payload);
};

export const emitRealtimeDashboardUpdate = (
  payload: Omit<RealtimeEventPayload, "at">,
) => {
  emitToUserRoom(payload.userId, "dashboard_updated", {
    ...payload,
    at: Date.now(),
  });
};

export const emitRealtimeInvoiceUpdated = (
  payload: Omit<InvoiceUpdatedPayload, "source"> & { source?: string },
) => {
  emitToUserRoom(payload.userId, "invoice_updated", {
    ...payload,
    at: Date.now(),
  });
};

export const emitRealtimePaymentAdded = (payload: PaymentAddedPayload) => {
  emitToUserRoom(payload.userId, "payment_added", {
    ...payload,
    at: Date.now(),
  });

  if (payload.computedStatus === "PAID" || payload.status === "PAID") {
    emitToUserRoom(payload.userId, "invoice_paid", {
      invoiceId: payload.invoiceId,
      paymentId: payload.paymentId,
      totalPaid: payload.totalPaid,
      at: Date.now(),
    });
  }
};

export const emitRealtimeNotificationCreated = (
  payload: NotificationRealtimePayload,
) => {
  emitToUserRoom(payload.userId, "notification_created", {
    ...payload,
    at: Date.now(),
  });
};

export const emitRealtimeNotificationUpdated = (
  payload: NotificationRealtimePayload,
) => {
  emitToUserRoom(payload.userId, "notification_updated", {
    ...payload,
    at: Date.now(),
  });
};

export const emitRealtimeNotificationDeleted = (
  payload: NotificationDeletedPayload,
) => {
  emitToUserRoom(payload.userId, "notification_deleted", {
    ...payload,
    at: Date.now(),
  });
};

export const emitRealtimeNotificationsReadAll = (payload: { userId: number }) => {
  emitToUserRoom(payload.userId, "notifications_read_all", {
    ...payload,
    at: Date.now(),
  });
};
