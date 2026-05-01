import test from "node:test";
import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import csrfProtectionMiddleware, {
  ensureCsrfCookie,
} from "./csrf.middleware.js";

const createResponse = () => {
  const cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const state = {
    statusCode: 200,
    body: null as unknown,
  };

  const response = {
    locals: {},
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, options });
      return this;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
  };

  return { response: response as unknown as Response, cookies, state };
};

const createRequest = (overrides?: Partial<Request>) =>
  ({
    method: "POST",
    path: "/api/auth/passkeys/authenticate/options",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    ...overrides,
  }) as Request;

test("sessionless passkey authenticate options route skips CSRF validation even when refresh cookie exists", () => {
  const req = createRequest({
    headers: {
      origin: "http://localhost:3000",
      cookie:
        "bill_sutra_refresh_token=refresh-token; bill_sutra_csrf_token=abcdefghijklmnopqrstuvwxyz123456",
    },
  });
  const { response, state } = createResponse();
  let nextCalled = false;

  csrfProtectionMiddleware(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(state.statusCode, 200);
});

test("refresh route rejects missing CSRF header when refresh cookie is present", () => {
  const req = createRequest({
    path: "/api/auth/refresh",
    headers: {
      origin: "http://localhost:3000",
      cookie:
        "bill_sutra_refresh_token=refresh-token; bill_sutra_csrf_token=abcdefghijklmnopqrstuvwxyz123456",
    },
  });
  const { response, state } = createResponse();
  let nextCalled = false;

  csrfProtectionMiddleware(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 403);
  assert.deepEqual(state.body, {
    status: 403,
    message: "CSRF validation failed",
    code: "CSRF_VALIDATION_FAILED",
  });
});

test("owner-scoped routes ignore unrelated admin cookies for CSRF protection", () => {
  const req = createRequest({
    path: "/api/products",
    headers: {
      origin: "http://localhost:3000",
      cookie:
        "bill_sutra_admin_session=admin-token; bill_sutra_csrf_token=abcdefghijklmnopqrstuvwxyz123456",
    },
  });
  const { response, state } = createResponse();
  let nextCalled = false;

  csrfProtectionMiddleware(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(state.statusCode, 200);
});

test("ensureCsrfCookie issues a token when one is missing", () => {
  const req = createRequest({
    method: "GET",
    path: "/api/auth/csrf",
    headers: {
      origin: "http://localhost:3000",
    },
  });
  const { response, cookies } = createResponse();
  let nextCalled = false;

  ensureCsrfCookie(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0]?.name, "bill_sutra_csrf_token");
  assert.ok(String(cookies[0]?.value ?? "").length >= 24);
});
