import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { ACCESS_TOKEN_COOKIE_NAME, parseCookies } from "../lib/authCookies.js";
import {
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";
import { getAllowedCorsOrigins } from "../lib/corsOrigins.js";

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

type AuthenticatedSocket = Socket & {
  data: {
    authUser?: AuthUser;
  };
};

let io: SocketIOServer | null = null;

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

const authenticateSocket = async (socket: AuthenticatedSocket) => {
  const token = resolveSocketToken(socket);
  if (!token) {
    throw new Error("missing_token");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  const authUser = await resolveAuthUserFromDecoded(decoded);
  if (!authUser) {
    throw new Error("invalid_user");
  }

  const latestSessionVersion = await getUserSessionVersionIfAvailable(
    authUser.ownerUserId,
  );

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
  });

  io.use((socket, next) => {
    void authenticateSocket(socket as AuthenticatedSocket)
      .then(() => next())
      .catch((error) => {
        console.warn("[socket] authentication failed", {
          socketId: socket.id,
          error: error instanceof Error ? error.message : String(error),
          origin: socket.handshake.headers.origin ?? null,
        });
        next(new Error("Unauthorized"));
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
