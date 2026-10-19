import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { clipboardTTL, getRedis } from "../lib/redis.ts";
import { readClipboard, writeClipboard } from "../lib/clipboard.ts";

afterEach(() => { mock.restoreAll(); });

test("production requires complete Redis configuration", () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.throws(getRedis, /configured in production/);
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  assert.throws(getRedis, /both/);
});

test("TTL defaults to a day and rejects invalid settings", () => {
  delete process.env.CLIPBOARD_TTL_SECONDS;
  assert.equal(clipboardTTL(), 86400);
  for (const value of ["0", "-1", "1.5", "abc", ""]) {
    process.env.CLIPBOARD_TTL_SECONDS = value;
    assert.throws(clipboardTTL, /positive integer/);
  }
  process.env.CLIPBOARD_TTL_SECONDS = "60";
  assert.equal(clipboardTTL(), 60);
});

test("Redis saves set an atomic expiry and reads do not refresh it", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  process.env.CLIPBOARD_REDIS_KEY = "test:clipboard";
  process.env.CLIPBOARD_TTL_SECONDS = "60";
  const commands: unknown[][] = [];
  let stored: string | null = null;
  mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const batch = JSON.parse(init.body as string) as unknown[][];
    const results = batch.map((command) => {
      commands.push(command);
      if (String(command[0]).toLowerCase() === "set") {
        stored = command[2] as string;
        return { result: "OK" };
      }
      return { result: stored === null ? null : Buffer.from(stored).toString("base64") };
    });
    return Response.json(results);
  });
  const saved = await writeClipboard("temporary text");
  assert.deepEqual(commands[0], ["set", "test:clipboard", JSON.stringify(saved), "ex", 60]);
  assert.deepEqual(await readClipboard(), saved);
  assert.deepEqual(commands[1], ["get", "test:clipboard"]);
  assert.equal(commands.length, 2);
  stored = null;
  assert.deepEqual(await readClipboard(), { text: "", updatedAt: null });
});
