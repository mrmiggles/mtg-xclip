import { createHash } from "node:crypto";
import { clipboardKey, getRedis } from "./redis.ts";

// Fixed ten-minute windows, shared across serverless instances through Redis.
const script = `local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 600) end
return count`;
const localAttempts = new Map<string, { count: number; expires: number }>();

export async function allowLogin(request: Request): Promise<boolean> {
  // Trust this header only when the hosting proxy overwrites client input.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${clipboardKey()}:login:${createHash("sha256").update(ip).digest("hex")}`;
  const redis = getRedis();
  if (redis) return await redis.eval<[], number>(script, [key], []) <= 10;
  for (const [key, value] of localAttempts) {
    if (value.expires <= Date.now()) localAttempts.delete(key);
  }
  const value = localAttempts.get(key) || { count: 0, expires: Date.now() + 600_000 };
  value.count++;
  localAttempts.set(key, value);
  return value.count <= 10;
}
