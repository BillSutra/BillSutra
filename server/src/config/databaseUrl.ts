const POSTGRES_PROTOCOLS = new Set(["postgresql:", "postgres:"]);
const SUPABASE_POOLER_SUFFIX = ".pooler.supabase.com";
const SUPABASE_DIRECT_HOST_MARKER = ".supabase.co";
const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/test?sslmode=disable";
const SAFE_DATABASE_URL_EXAMPLE =
  "postgresql://app_user:pa%24%24word@db.example.com:5432/billsutra?sslmode=require";
const SAFE_SUPABASE_RUNTIME_URL_EXAMPLE =
  "postgresql://postgres.project-ref:pa%24%24word@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=30&sslmode=require";
const SAFE_SUPABASE_DIRECT_URL_EXAMPLE =
  "postgresql://postgres.project-ref:pa%24%24word@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require";

type DatabaseRuntimeEnv = {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  NODE_ENV?: string;
  npm_lifecycle_event?: string;
  PRISMA_CONNECTION_LIMIT?: string;
  PRISMA_POOL_TIMEOUT?: string;
};

type RuntimeDefaultsApplied = {
  connectionLimit: boolean;
  poolTimeout: boolean;
  sslmode: boolean;
  pgbouncer: boolean;
};

type DatabaseConnectionRole = "runtime" | "direct";
type DatabasePoolMode =
  | "direct"
  | "supabase-transaction"
  | "supabase-session"
  | "supabase-pooler"
  | "generic";

export type DatabaseUrlDiagnostics = {
  role: DatabaseConnectionRole;
  protocol: string;
  username: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  hasUsername: boolean;
  hasPassword: boolean;
  queryParamKeys: string[];
  sslmode: string | null;
  connectionLimit: number | null;
  poolTimeout: number | null;
  pgbouncer: boolean;
  credentialsNormalized: boolean;
  likelyBadCredentialCharacters: string[];
  runtimeDefaultsApplied: RuntimeDefaultsApplied;
  isSupabase: boolean;
  isSupabasePooler: boolean;
  poolMode: DatabasePoolMode;
};

export type ResolvedDatabaseUrl = {
  value: string;
  diagnostics: DatabaseUrlDiagnostics;
};

export type ResolvedDatabaseConfig = {
  runtime: ResolvedDatabaseUrl;
  direct: ResolvedDatabaseUrl | null;
  directUrlSource: "env" | "derived-from-runtime" | "missing";
  warnings: string[];
};

type DatabaseUrlValidationIssue =
  | "missing"
  | "protocol"
  | "format"
  | "host"
  | "database";

type DatabaseUrlValidationDetails = {
  issue: DatabaseUrlValidationIssue;
  likelyBadCredentialCharacters?: string[];
  example: string;
};

type ParsedPostgresUrl = {
  protocol: string;
  username: string | null;
  password: string | null;
  hasCredentials: boolean;
  hostAndPath: string;
};

export class DatabaseUrlValidationError extends Error {
  readonly details: DatabaseUrlValidationDetails;

  constructor(message: string, details: DatabaseUrlValidationDetails) {
    super(message);
    this.name = "DatabaseUrlValidationError";
    this.details = details;
  }
}

const resolvePositiveNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const stripWrappingQuotes = (value: string) =>
  value.trim().replace(/^"(.*)"$/, "$1");

const isTestRun = (env: DatabaseRuntimeEnv) =>
  env.NODE_ENV === "test" ||
  process.argv.includes("--test") ||
  env.npm_lifecycle_event?.startsWith("test:") === true;

const tryParseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const safeEncodeUrlComponent = (value: string) => {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
};

const parsePostgresUrl = (value: string): ParsedPostgresUrl | null => {
  const protocolMatch = value.match(/^([a-z0-9+.-]+):\/\//i);

  if (!protocolMatch) {
    return null;
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`;
  const remainder = value.slice(protocolMatch[0].length);
  const lastAtIndex = remainder.lastIndexOf("@");
  const authSegment = lastAtIndex >= 0 ? remainder.slice(0, lastAtIndex) : null;
  const hostAndPath =
    lastAtIndex >= 0 ? remainder.slice(lastAtIndex + 1) : remainder;

  if (authSegment === null) {
    return {
      protocol,
      username: null,
      password: null,
      hasCredentials: false,
      hostAndPath,
    };
  }

  const separatorIndex = authSegment.indexOf(":");

  if (separatorIndex === -1) {
    return {
      protocol,
      username: authSegment,
      password: null,
      hasCredentials: true,
      hostAndPath,
    };
  }

  return {
    protocol,
    username: authSegment.slice(0, separatorIndex),
    password: authSegment.slice(separatorIndex + 1),
    hasCredentials: true,
    hostAndPath,
  };
};

const describeCharacter = (character: string) => {
  if (character === " ") return "space";
  if (character === "\t") return "tab";
  if (character === "\n") return "newline";
  if (character === "\r") return "carriage-return";
  return character;
};

const isHexDigit = (character: string | undefined) =>
  character !== undefined && /^[0-9a-f]$/i.test(character);

const collectUnsafeCharacters = (value: string) => {
  const matches = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (
      character === "%" &&
      isHexDigit(value[index + 1]) &&
      isHexDigit(value[index + 2])
    ) {
      index += 2;
      continue;
    }

    if (safeEncodeUrlComponent(character) !== character) {
      matches.add(describeCharacter(character));
    }
  }

  return matches;
};

const collectLikelyBadCredentialCharacters = (
  parsed: ParsedPostgresUrl | null,
) => {
  if (!parsed?.hasCredentials) {
    return [] as string[];
  }

  const matches = new Set<string>();
  for (const character of collectUnsafeCharacters(parsed.username ?? "")) {
    matches.add(character);
  }
  for (const character of collectUnsafeCharacters(parsed.password ?? "")) {
    matches.add(character);
  }

  return [...matches];
};

const sanitizePostgresCredentials = (value: string) => {
  const parsed = parsePostgresUrl(value);

  if (
    !parsed ||
    !POSTGRES_PROTOCOLS.has(parsed.protocol) ||
    !parsed.hasCredentials
  ) {
    return value;
  }

  const encodedUsername = safeEncodeUrlComponent(parsed.username ?? "");

  if (parsed.password === null) {
    return `${parsed.protocol}//${encodedUsername}@${parsed.hostAndPath}`;
  }

  const encodedPassword = safeEncodeUrlComponent(parsed.password);

  return `${parsed.protocol}//${encodedUsername}:${encodedPassword}@${parsed.hostAndPath}`;
};

const buildInvalidUrlError = (value: string) => {
  const parsed = parsePostgresUrl(value);
  const likelyBadCredentialCharacters =
    collectLikelyBadCredentialCharacters(parsed);

  if (!parsed) {
    return new DatabaseUrlValidationError(
      "DATABASE_URL must start with postgresql:// or postgres://.",
      {
        issue: "protocol",
        example: SAFE_DATABASE_URL_EXAMPLE,
      },
    );
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    return new DatabaseUrlValidationError(
      "DATABASE_URL must use the PostgreSQL protocol: postgresql:// or postgres://.",
      {
        issue: "protocol",
        example: SAFE_DATABASE_URL_EXAMPLE,
      },
    );
  }

  const hint =
    likelyBadCredentialCharacters.length > 0
      ? ` Likely unencoded credential characters: ${likelyBadCredentialCharacters.join(", ")}.`
      : "";

  return new DatabaseUrlValidationError(
    `DATABASE_URL is invalid.${hint} URL-encode reserved characters in the username and password.`,
    {
      issue: "format",
      likelyBadCredentialCharacters,
      example: SAFE_DATABASE_URL_EXAMPLE,
    },
  );
};

const isSupabasePoolerHost = (hostname: string) =>
  hostname.endsWith(SUPABASE_POOLER_SUFFIX);

const isSupabaseDirectHost = (hostname: string) =>
  hostname.startsWith("db.") && hostname.includes(SUPABASE_DIRECT_HOST_MARKER);

const resolvePoolMode = (url: URL): DatabasePoolMode => {
  if (isSupabasePoolerHost(url.hostname)) {
    if (url.port === "6543") {
      return "supabase-transaction";
    }

    if (url.port === "5432") {
      return "supabase-session";
    }

    return "supabase-pooler";
  }

  if (isSupabaseDirectHost(url.hostname)) {
    return "direct";
  }

  return "generic";
};

const applyRoleDefaults = (
  url: URL,
  env: DatabaseRuntimeEnv,
  role: DatabaseConnectionRole,
) => {
  const runtimeDefaultsApplied: RuntimeDefaultsApplied = {
    connectionLimit: false,
    poolTimeout: false,
    sslmode: !url.searchParams.has("sslmode"),
    pgbouncer: false,
  };

  if (role === "runtime") {
    const configuredConnectionLimit = resolvePositiveNumber(
      env.PRISMA_CONNECTION_LIMIT,
    );
    const configuredPoolTimeout = resolvePositiveNumber(
      env.PRISMA_POOL_TIMEOUT,
    );
    const existingConnectionLimit = resolvePositiveNumber(
      url.searchParams.get("connection_limit"),
    );
    const existingPoolTimeout = resolvePositiveNumber(
      url.searchParams.get("pool_timeout"),
    );

    runtimeDefaultsApplied.connectionLimit =
      configuredConnectionLimit === null && existingConnectionLimit === null;
    runtimeDefaultsApplied.poolTimeout =
      configuredPoolTimeout === null && existingPoolTimeout === null;

    const normalizedConnectionLimit = String(
      configuredConnectionLimit ?? existingConnectionLimit ?? 10,
    );
    const normalizedPoolTimeout = String(
      configuredPoolTimeout ?? existingPoolTimeout ?? 30,
    );

    url.searchParams.set("connection_limit", normalizedConnectionLimit);
    url.searchParams.set("pool_timeout", normalizedPoolTimeout);

    if (
      resolvePoolMode(url) === "supabase-transaction" &&
      !url.searchParams.has("pgbouncer")
    ) {
      url.searchParams.set("pgbouncer", "true");
      runtimeDefaultsApplied.pgbouncer = true;
    }
  } else {
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("pool_timeout");
  }

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  return runtimeDefaultsApplied;
};

const decodeDatabaseName = (pathname: string) => {
  const normalized = pathname.replace(/^\/+/, "");
  if (!normalized) return null;

  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
};

const resolveSingleDatabaseUrl = ({
  rawValue,
  env,
  role,
}: {
  rawValue: string;
  env: DatabaseRuntimeEnv;
  role: DatabaseConnectionRole;
}): ResolvedDatabaseUrl => {
  const trimmedUrl = stripWrappingQuotes(rawValue);
  const normalizedCredentialUrl = sanitizePostgresCredentials(trimmedUrl);
  const parsedUrl = tryParseUrl(normalizedCredentialUrl);

  if (!parsedUrl) {
    throw buildInvalidUrlError(trimmedUrl);
  }

  if (!POSTGRES_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new DatabaseUrlValidationError(
      "DATABASE_URL must use the PostgreSQL protocol: postgresql:// or postgres://.",
      {
        issue: "protocol",
        example: SAFE_DATABASE_URL_EXAMPLE,
      },
    );
  }

  if (!parsedUrl.hostname) {
    throw new DatabaseUrlValidationError(
      "DATABASE_URL must include a database host.",
      {
        issue: "host",
        example: SAFE_DATABASE_URL_EXAMPLE,
      },
    );
  }

  const databaseName = decodeDatabaseName(parsedUrl.pathname);

  if (!databaseName) {
    throw new DatabaseUrlValidationError(
      "DATABASE_URL must include a database name in the path.",
      {
        issue: "database",
        example: SAFE_DATABASE_URL_EXAMPLE,
      },
    );
  }

  const likelyBadCredentialCharacters = collectLikelyBadCredentialCharacters(
    parsePostgresUrl(trimmedUrl),
  );
  const runtimeDefaultsApplied = applyRoleDefaults(parsedUrl, env, role);
  const poolMode = resolvePoolMode(parsedUrl);

  return {
    value: parsedUrl.toString(),
    diagnostics: {
      role,
      protocol: parsedUrl.protocol.replace(/:$/, ""),
      username: parsedUrl.username
        ? decodeURIComponent(parsedUrl.username)
        : null,
      host: parsedUrl.hostname || null,
      port: parsedUrl.port || null,
      database: databaseName,
      hasUsername: parsedUrl.username.length > 0,
      hasPassword: parsedUrl.password.length > 0,
      queryParamKeys: [...new Set(parsedUrl.searchParams.keys())].sort(),
      sslmode: parsedUrl.searchParams.get("sslmode"),
      connectionLimit: resolvePositiveNumber(
        parsedUrl.searchParams.get("connection_limit"),
      ),
      poolTimeout: resolvePositiveNumber(
        parsedUrl.searchParams.get("pool_timeout"),
      ),
      pgbouncer: parsedUrl.searchParams.get("pgbouncer") === "true",
      credentialsNormalized: normalizedCredentialUrl !== trimmedUrl,
      likelyBadCredentialCharacters,
      runtimeDefaultsApplied,
      isSupabase:
        isSupabasePoolerHost(parsedUrl.hostname) ||
        isSupabaseDirectHost(parsedUrl.hostname),
      isSupabasePooler: isSupabasePoolerHost(parsedUrl.hostname),
      poolMode,
    },
  };
};

const buildTestDatabaseConfig = (): ResolvedDatabaseConfig => ({
  runtime: {
    value: TEST_DATABASE_URL,
    diagnostics: {
      role: "runtime",
      protocol: "postgresql",
      username: "postgres",
      host: "localhost",
      port: "5432",
      database: "test",
      hasUsername: true,
      hasPassword: true,
      queryParamKeys: ["sslmode"],
      sslmode: "disable",
      connectionLimit: null,
      poolTimeout: null,
      pgbouncer: false,
      credentialsNormalized: false,
      likelyBadCredentialCharacters: [],
      runtimeDefaultsApplied: {
        connectionLimit: false,
        poolTimeout: false,
        sslmode: false,
        pgbouncer: false,
      },
      isSupabase: false,
      isSupabasePooler: false,
      poolMode: "generic",
    },
  },
  direct: null,
  directUrlSource: "missing",
  warnings: [],
});

const deriveSupabaseDirectUrl = (
  runtime: ResolvedDatabaseUrl,
  env: DatabaseRuntimeEnv,
) => {
  if (!runtime.diagnostics.isSupabasePooler) {
    return null;
  }

  const parsedUrl = new URL(runtime.value);
  parsedUrl.port = "5432";
  parsedUrl.searchParams.delete("pgbouncer");
  parsedUrl.searchParams.delete("connection_limit");
  parsedUrl.searchParams.delete("pool_timeout");
  parsedUrl.searchParams.set("sslmode", "require");

  return resolveSingleDatabaseUrl({
    rawValue: parsedUrl.toString(),
    env,
    role: "direct",
  });
};

export const resolveDatabaseConfig = (
  env: DatabaseRuntimeEnv = process.env as DatabaseRuntimeEnv,
): ResolvedDatabaseConfig => {
  const rawRuntimeUrl = env.DATABASE_URL;

  if (!rawRuntimeUrl) {
    if (isTestRun(env)) {
      return buildTestDatabaseConfig();
    }

    throw new DatabaseUrlValidationError("DATABASE_URL is not set.", {
      issue: "missing",
      example: SAFE_SUPABASE_RUNTIME_URL_EXAMPLE,
    });
  }

  const runtime = resolveSingleDatabaseUrl({
    rawValue: rawRuntimeUrl,
    env,
    role: "runtime",
  });

  const warnings: string[] = [];
  let direct: ResolvedDatabaseUrl | null = null;
  let directUrlSource: ResolvedDatabaseConfig["directUrlSource"] = "missing";

  if (env.DIRECT_URL) {
    direct = resolveSingleDatabaseUrl({
      rawValue: env.DIRECT_URL,
      env,
      role: "direct",
    });
    directUrlSource = "env";
  } else {
    direct = deriveSupabaseDirectUrl(runtime, env);

    if (direct) {
      directUrlSource = "derived-from-runtime";
      warnings.push(
        "DIRECT_URL is not set. Prisma CLI should use a non-transaction-pooled connection. A session-pooler fallback was derived for runtime diagnostics, but you should store DIRECT_URL explicitly in server/.env for prisma migrate and prisma db push.",
      );
    }
  }

  if (runtime.diagnostics.isSupabasePooler && !runtime.diagnostics.pgbouncer) {
    warnings.push(
      "Supabase transaction pooler URLs should include pgbouncer=true for Prisma compatibility. The runtime URL was normalized automatically, but server/.env should be updated to match.",
    );
  }

  if (
    runtime.diagnostics.poolMode === "supabase-transaction" &&
    direct?.diagnostics.poolMode === "supabase-transaction"
  ) {
    warnings.push(
      "DIRECT_URL is still using Supabase transaction pooling on port 6543. Prisma CLI commands can fail in that mode; prefer a direct DB host or the Supabase session pooler on port 5432.",
    );
  }

  if (
    runtime.diagnostics.isSupabasePooler &&
    runtime.diagnostics.username?.startsWith("postgres.") &&
    !env.DIRECT_URL
  ) {
    warnings.push(
      "Supabase credentials parse correctly, but authentication can still fail if the password does not belong to the selected role. If you created a dedicated Prisma role, use prisma.<project-ref> with that role's password instead of postgres.<project-ref>.",
    );
  }

  return {
    runtime,
    direct,
    directUrlSource,
    warnings,
  };
};

export const resolveDatabaseUrl = (
  env: DatabaseRuntimeEnv = process.env as DatabaseRuntimeEnv,
): ResolvedDatabaseUrl => resolveDatabaseConfig(env).runtime;

export const initializeDatabaseConnections = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const resolved = resolveDatabaseConfig(env as DatabaseRuntimeEnv);
  env.DATABASE_URL = resolved.runtime.value;

  if (resolved.direct) {
    env.DIRECT_URL = resolved.direct.value;
  }

  return resolved;
};

export const initializeDatabaseUrl = (
  env: NodeJS.ProcessEnv = process.env,
) => initializeDatabaseConnections(env).runtime;

export const logDatabaseStartupDiagnostics = (
  resolved: ResolvedDatabaseConfig,
) => {
  console.info("[startup.db] configuration validated", {
    runtime: {
      username: resolved.runtime.diagnostics.username,
      host: resolved.runtime.diagnostics.host,
      port: resolved.runtime.diagnostics.port,
      database: resolved.runtime.diagnostics.database,
      sslmode: resolved.runtime.diagnostics.sslmode,
      pgbouncer: resolved.runtime.diagnostics.pgbouncer,
      connectionLimit: resolved.runtime.diagnostics.connectionLimit,
      poolTimeout: resolved.runtime.diagnostics.poolTimeout,
      poolMode: resolved.runtime.diagnostics.poolMode,
      credentialsNormalized: resolved.runtime.diagnostics.credentialsNormalized,
    },
    direct: resolved.direct
      ? {
          source: resolved.directUrlSource,
          username: resolved.direct.diagnostics.username,
          host: resolved.direct.diagnostics.host,
          port: resolved.direct.diagnostics.port,
          database: resolved.direct.diagnostics.database,
          sslmode: resolved.direct.diagnostics.sslmode,
          poolMode: resolved.direct.diagnostics.poolMode,
        }
      : {
          source: resolved.directUrlSource,
          configured: false,
        },
  });

  if (resolved.runtime.diagnostics.credentialsNormalized) {
    console.warn(
      "[startup.db] DATABASE_URL credentials were normalized at runtime. Update server/.env to use percent-encoded credentials so Prisma CLI and startup stay aligned.",
      {
        likelyBadCredentialCharacters:
          resolved.runtime.diagnostics.likelyBadCredentialCharacters,
      },
    );
  }

  for (const warning of resolved.warnings) {
    console.warn("[startup.db] configuration warning", { warning });
  }
};

const safeResolveConfigForLogging = () => {
  try {
    return resolveDatabaseConfig(process.env as DatabaseRuntimeEnv);
  } catch {
    return null;
  }
};

export const logDatabaseStartupFailure = (error: unknown) => {
  if (error instanceof DatabaseUrlValidationError) {
    console.error("[startup.db] invalid DATABASE_URL", {
      issue: error.details.issue,
      likelyBadCredentialCharacters:
        error.details.likelyBadCredentialCharacters ?? [],
      example: error.details.example,
      recommendedSupabaseRuntimeExample: SAFE_SUPABASE_RUNTIME_URL_EXAMPLE,
      recommendedSupabaseDirectExample: SAFE_SUPABASE_DIRECT_URL_EXAMPLE,
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const resolved = safeResolveConfigForLogging();

  if (/Authentication failed against database server/i.test(message)) {
    console.error("[startup.db] database authentication failed", {
      username: resolved?.runtime.diagnostics.username ?? null,
      host: resolved?.runtime.diagnostics.host ?? null,
      port: resolved?.runtime.diagnostics.port ?? null,
      database: resolved?.runtime.diagnostics.database ?? null,
      sslmode: resolved?.runtime.diagnostics.sslmode ?? null,
      poolMode: resolved?.runtime.diagnostics.poolMode ?? null,
      directUrlConfigured: resolved?.directUrlSource === "env",
      guidance: [
        "The DATABASE_URL format is valid, so the failure is now at the credential layer.",
        "Verify that the password belongs to the selected Supabase role in the username portion of the URL.",
        "If you created a dedicated Prisma role in Supabase, use prisma.<project-ref> with that role password instead of postgres.<project-ref>.",
        "Keep sslmode=require, and use DIRECT_URL on port 5432 for prisma migrate / prisma db push.",
      ],
    });
    return;
  }

  console.error("[startup.db] database startup failed", {
    error: message,
  });
};
