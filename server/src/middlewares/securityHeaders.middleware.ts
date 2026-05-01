import helmet from "helmet";
import { getAllowedCorsOrigins } from "../lib/corsOrigins.js";

const isProd = process.env.NODE_ENV === "production";

const toWebSocketOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return null;
  }
};

const buildConnectSources = () => {
  const origins = getAllowedCorsOrigins();
  const websocketOrigins = origins
    .map((origin) => toWebSocketOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  return Array.from(new Set(["'self'", ...origins, ...websocketOrigins]));
};

const contentSecurityPolicy = helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    fontSrc: ["'self'", "data:", "https:"],
    connectSrc: buildConnectSources(),
    frameSrc: ["'self'", "https://checkout.razorpay.com"],
    formAction: ["'self'"],
    ...(isProd ? { upgradeInsecureRequests: [] } : {}),
  },
});

const securityHeadersMiddleware = [
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups",
    },
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    frameguard: {
      action: "deny",
    },
    hidePoweredBy: true,
    xDnsPrefetchControl: {
      allow: false,
    },
    hsts: isProd
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
  }),
  contentSecurityPolicy,
];

export default securityHeadersMiddleware;
