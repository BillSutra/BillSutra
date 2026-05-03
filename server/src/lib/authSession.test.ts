import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthUserFromDecoded } from "./authSession.js";

test("worker auth claims normalize role and recover worker id from actor id", async () => {
  const authUser = await resolveAuthUserFromDecoded({
    id: 1,
    ownerUserId: 1,
    actorId: "worker:worker_123",
    businessId: "business_123",
    sessionVersion: 0,
    role: "ADMIN",
    accountType: "WORKER",
    name: "Aashu",
    email: "aashu@example.com",
  });

  assert.equal(authUser?.accountType, "WORKER");
  assert.equal(authUser?.role, "WORKER");
  assert.equal(authUser?.workerId, "worker_123");
  assert.equal(authUser?.ownerUserId, 1);
});
