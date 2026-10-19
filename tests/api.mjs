import assert from "node:assert/strict";

// Run against an isolated instance: this check replaces and clears its clipboard.
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const url = `${base}/api/clipboard`;
const password = process.env.TEST_PASSWORD;
assert.ok(password, "Set TEST_PASSWORD to the isolated instance's clipboard password.");
const denied = await fetch(url);
assert.equal(denied.status, 401);
assert.equal((await fetch(url, { method: "PUT", body: JSON.stringify({ text: "unauthorized" }) })).status, 401);
const landing = await fetch(base, { redirect: "manual" });
assert.equal(landing.status, 307);
assert.equal(landing.headers.get("location"), "/login");

async function login(value) {
  return fetch(`${base}/api/login`, {
    method: "POST", headers: { Origin: base }, redirect: "manual",
    body: new URLSearchParams({ password: value }),
  });
}
const invalid = await login(`${password}-wrong`);
assert.equal(invalid.headers.get("location"), "/login?error=invalid");
assert.equal(invalid.headers.get("set-cookie"), null);
const signedIn = await login(password);
assert.equal(signedIn.status, 303);
assert.equal(signedIn.headers.get("location"), "/");
const setCookie = signedIn.headers.get("set-cookie");
assert.match(setCookie, /HttpOnly/i);
assert.match(setCookie, /SameSite=strict/i);
assert.equal(setCookie.includes(password), false);
const cookie = setCookie.split(";")[0];
const page = await fetch(base, { headers: { Cookie: cookie } });
assert.equal(page.status, 200);
assert.match(await page.text(), /Your text, anywhere/);

const text = "Shared across clients 👋\n  Keep whitespace.\t";
const saved = await fetch(url, {
  method: "PUT", headers: { "Content-Type": "application/json", Origin: base, Cookie: cookie },
  body: JSON.stringify({ text }),
});
assert.equal(saved.status, 200);
const secondLogin = await login(password);
const secondCookie = secondLogin.headers.get("set-cookie").split(";")[0];
const otherClient = await fetch(url, { cache: "no-store", headers: { Cookie: secondCookie } });
assert.equal(otherClient.headers.get("cache-control"), "no-store");
assert.equal((await otherClient.json()).text, text);

for (const [body, status] of [[{ text: 123 }, 400], [{ text: "x".repeat(100001) }, 413]]) {
  const response = await fetch(url, { method: "PUT", headers: { Cookie: cookie }, body: JSON.stringify(body) });
  assert.equal(response.status, status);
}
const crossOrigin = await fetch(url, {
  method: "PUT", headers: { Origin: "https://example.com", Cookie: cookie },
  body: JSON.stringify({ text: "blocked" }),
});
assert.equal(crossOrigin.status, 403);
assert.equal((await (await fetch(url, { headers: { Cookie: cookie } })).json()).text, text);
await fetch(url, { method: "PUT", headers: { Cookie: cookie }, body: JSON.stringify({ text: "" }) });
assert.equal((await (await fetch(url, { headers: { Cookie: cookie } })).json()).text, "");
const logout = await fetch(`${base}/api/logout`, { method: "POST", headers: { Cookie: cookie, Origin: base }, redirect: "manual" });
assert.equal(logout.status, 303);
assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
assert.equal((await fetch(url)).status, 401);
for (let i = 0; i < 7; i++) await login(`${password}-wrong`);
assert.equal((await login(password)).headers.get("location"), "/login?error=limited");
console.log("PASS: login, unauthorized access, session cookie, page render, independent-client save/read, no-cache, validation, size limit, cross-origin rejection, clear, logout, login attempt limit.");
