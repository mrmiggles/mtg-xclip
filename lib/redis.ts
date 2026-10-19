import { Redis } from "@upstash/redis";

let client: Redis | undefined;

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    client ??= new Redis({ url, token });
    return client;
  }
  if (url || token) throw new Error("Set both Upstash Redis environment variables.");
  if (process.env.NODE_ENV === "production") throw new Error("Redis must be configured in production.");
  return null;
}

export function clipboardTTL(): number {
  const seconds = Number(process.env.CLIPBOARD_TTL_SECONDS ?? 86400);
  if (!Number.isSafeInteger(seconds) || seconds < 1) {
    throw new Error("CLIPBOARD_TTL_SECONDS must be a positive integer.");
  }
  return seconds;
}

export function clipboardKey(): string {
  return process.env.CLIPBOARD_REDIS_KEY || "xclip:clipboard";
}
