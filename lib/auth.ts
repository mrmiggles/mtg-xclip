import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "xclip-session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

export function configuredPassword(): string {
  const password = process.env.CLIPBOARD_PASSWORD;
  if (!password) throw new Error("Set CLIPBOARD_PASSWORD before using the clipboard.");
  return password;
}

function digest(value: string): Buffer { return createHash("sha256").update(value).digest(); }

export function passwordMatches(candidate: string): boolean {
  return timingSafeEqual(digest(candidate), digest(configuredPassword()));
}

function signature(payload: string): Buffer {
  return createHmac("sha256", configuredPassword()).update(`xclip-session:v1:${payload}`).digest();
}

export function createSession(now = Date.now()): string {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function validSession(token: string | undefined, now = Date.now()): boolean {
  if (!token || !process.env.CLIPBOARD_PASSWORD || token.length > 256) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  const expires = Number(parts[0]);
  const seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + SESSION_SECONDS) return false;
  const expected = signature(`${parts[0]}.${parts[1]}`);
  const received = Buffer.from(parts[2], "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients still need authorization.
  try { return new URL(origin).host === request.headers.get("host"); }
  catch { return false; }
}
