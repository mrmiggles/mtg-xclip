import { test } from "node:test";
import assert from "node:assert/strict";
import { allowLogin } from "../lib/login-limit.ts";

test("login limits allow ten attempts per IP and isolate other IPs", async () => {
  Object.assign(process.env, { NODE_ENV: "test" });
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const request = new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.1" } });
  for (let i = 0; i < 10; i++) assert.equal(await allowLogin(request), true);
  assert.equal(await allowLogin(request), false);
  assert.equal(await allowLogin(new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.2" } })), true);
});
