import assert from "node:assert/strict";
import test from "node:test";
import {
  DatabaseUrlValidationError,
  resolveDatabaseConfig,
  resolveDatabaseUrl,
} from "./databaseUrl.js";

test("normalizes reserved characters in postgres credentials", () => {
  const resolved = resolveDatabaseUrl({
    DATABASE_URL:
      "postgresql://app_user:p/ss?word#hash@db.example.com:5432/billsutra",
    NODE_ENV: "production",
  });

  assert.equal(resolved.diagnostics.credentialsNormalized, true);
  assert.deepEqual(resolved.diagnostics.likelyBadCredentialCharacters, [
    "/",
    "?",
    "#",
  ]);
  assert.equal(resolved.diagnostics.host, "db.example.com");
  assert.equal(resolved.diagnostics.database, "billsutra");
  assert.equal(resolved.diagnostics.sslmode, "require");
  assert.match(resolved.value, /p%2Fss%3Fword%23hash/);
});

test("rejects non-postgres database urls with a clear protocol error", () => {
  assert.throws(
    () =>
      resolveDatabaseUrl({
        DATABASE_URL: "mysql://user:password@db.example.com:3306/billsutra",
        NODE_ENV: "production",
      }),
    (error: unknown) => {
      assert.ok(error instanceof DatabaseUrlValidationError);
      assert.equal(error.details.issue, "protocol");
      assert.match(error.message, /postgresql:\/\/ or postgres:\/\//);
      return true;
    },
  );
});

test("rejects urls without a database name", () => {
  assert.throws(
    () =>
      resolveDatabaseUrl({
        DATABASE_URL: "postgresql://user:password@db.example.com:5432",
        NODE_ENV: "production",
      }),
    (error: unknown) => {
      assert.ok(error instanceof DatabaseUrlValidationError);
      assert.equal(error.details.issue, "database");
      assert.match(error.message, /database name/);
      return true;
    },
  );
});

test("does not flag already encoded percent escapes as bad credential characters", () => {
  const resolved = resolveDatabaseUrl({
    DATABASE_URL:
      "postgresql://app_user:pa%25ss@db.example.com:5432/billsutra?sslmode=require",
    NODE_ENV: "production",
  });

  assert.equal(resolved.diagnostics.credentialsNormalized, false);
  assert.deepEqual(resolved.diagnostics.likelyBadCredentialCharacters, []);
  assert.match(resolved.value, /pa%25ss/);
});

test("adds pgbouncer compatibility for Supabase transaction pooler runtime urls", () => {
  const resolved = resolveDatabaseUrl({
    DATABASE_URL:
      "postgresql://postgres.project-ref:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require",
    NODE_ENV: "production",
  });

  assert.equal(resolved.diagnostics.poolMode, "supabase-transaction");
  assert.equal(resolved.diagnostics.pgbouncer, true);
  assert.equal(new URL(resolved.value).searchParams.get("pgbouncer"), "true");
});

test("derives a CLI-safe DIRECT_URL from Supabase runtime pooling when missing", () => {
  const resolved = resolveDatabaseConfig({
    DATABASE_URL:
      "postgresql://postgres.project-ref:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30&sslmode=require",
    NODE_ENV: "production",
  });

  assert.equal(resolved.directUrlSource, "derived-from-runtime");
  assert.equal(resolved.direct?.diagnostics.poolMode, "supabase-session");
  assert.equal(resolved.direct?.diagnostics.port, "5432");
  assert.equal(new URL(resolved.direct?.value ?? "").searchParams.get("pgbouncer"), null);
  assert.equal(
    new URL(resolved.direct?.value ?? "").searchParams.get("sslmode"),
    "require",
  );
});
