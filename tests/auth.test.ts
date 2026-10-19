import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createSession, passwordMatches, sameOrigin, SESSION_SECONDS, validSession } from "../lib/auth.ts";

const previous = process.env.CLIPBOARD_PASSWORD;
process.env.CLIPBOARD_PASSWORD = "a-test-password-that-is-only-used-in-tests";
after(() => {
  if (previous === undefined) delete process.env.CLIPBOARD_PASSWORD;
  else process.env.CLIPBOARD_PASSWORD = previous;
});

test("only the configured password matches", () => {
  assert.equal(passwordMatches("a-test-password-that-is-only-used-in-tests"), true);
  assert.equal(passwordMatches("wrong"), false);
  assert.equal(passwordMatches(""), false);
});

test("sessions expire, reject tampering, and contain no password", () => {
  const now = Date.now();
  const token = createSession(now);
  assert.equal(token.includes(process.env.CLIPBOARD_PASSWORD!), false);
  assert.equal(validSession(token, now), true);
  assert.equal(validSession(token, now + SESSION_SECONDS * 1000), false);
  const [expires, nonce, signature] = token.split(".");
  assert.equal(validSession(`${expires}.${nonce}changed.${signature}`, now), false);
  assert.equal(validSession(`${Number(expires) + 1}.${nonce}.${signature}`, now), false);
  assert.equal(validSession(`${expires}.${nonce}.invalid`, now), false);
  assert.equal(validSession(undefined, now), false);
  assert.equal(validSession("malformed", now), false);
});

test("changing or removing the password invalidates existing sessions", () => {
  const password = process.env.CLIPBOARD_PASSWORD;
  const token = createSession();
  process.env.CLIPBOARD_PASSWORD = "another-password";
  assert.equal(validSession(token), false);
  delete process.env.CLIPBOARD_PASSWORD;
  assert.equal(validSession(token), false);
  assert.throws(() => passwordMatches(""), /CLIPBOARD_PASSWORD/);
  process.env.CLIPBOARD_PASSWORD = password;
});

test("same-origin writes work behind a proxy and foreign origins are rejected", () => {
  const request = (origin: string) => new Request("http://0.0.0.0:3000", {
    headers: { host: "clipboard.example.com", origin },
  });
  assert.equal(sameOrigin(request("https://clipboard.example.com")), true);
  assert.equal(sameOrigin(request("https://attacker.example.com")), false);
  assert.equal(sameOrigin(request("null")), false);
});
