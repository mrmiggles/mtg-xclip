# xclip

A password-protected Next.js shared clipboard. Paste in one browser, then open the same URL in another to read or copy. Changes save after 600 ms and other browsers sync every 2 seconds. The most recent save wins during simultaneous edits.

## Local development

Requires Node.js 22.18+.

```sh
npm install
cp .env.example .env.local
```

Set `CLIPBOARD_PASSWORD` in `.env.local`, then start:

```sh
npm run dev
```

Open http://localhost:3000 and enter your password. For another device on your network, use `http://<your-computer-LAN-IP>:3000`. The development server listens on all interfaces.

Without Redis credentials, development uses `data/clipboard.json` (or `CLIPBOARD_DATA_DIR`). Expired local text is excluded from reads; Redis physically expires hosted clipboard records. Production requires Redis and does not fall back to local files.

## Hosting with Vercel + Upstash Redis

1. Create an Upstash Redis database and copy its REST URL and REST token.
2. Import this project into Vercel as a Next.js app.
3. Add the following server environment variables in the hosting dashboard:

| Variable | Purpose |
| --- | --- |
| `CLIPBOARD_PASSWORD` | Shared access password; use a long, randomly generated value. |
| `UPSTASH_REDIS_REST_URL` | Upstash database REST URL. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash database REST token with read/write access. |
| `CLIPBOARD_TTL_SECONDS` | Optional; defaults to `86400` (24 hours). |
| `CLIPBOARD_REDIS_KEY` | Optional; defaults to `xclip:clipboard`. Use a different key for preview deployments. |

4. Deploy and open the HTTPS URL from any browser.

Keep these variables server-only: **do not use the `NEXT_PUBLIC_` prefix**. `.env.local` is ignored by Git. Secrets are not placed in the browser bundle. A production server can also be run with `npm run build` and `npm start` when the same environment variables are configured. Production cookies require HTTPS.

The clipboard expires after the configured time **since the last save**. Reading or copying does not extend expiry. A new save resets the timer. All signed-in browsers share one clipboard. The limit is 100,000 characters.

Each active browser polls every 2 seconds, roughly 1,800 Redis reads per hour while open. Account for that when selecting a Redis plan.

## Password access

The password is checked on the server. A successful login sets a signed, HttpOnly, SameSite=Strict cookie, secure in production, that expires after seven days. The clipboard API checks authentication for both reads and writes. Missing password configuration blocks access. Sign out clears the current browser's cookie; changing `CLIPBOARD_PASSWORD` invalidates all sessions (redeploy/restart after changing it).

Login permits ten attempts per IP in a ten-minute window, stored in Redis across server instances. Your hosting proxy must overwrite `X-Forwarded-For` with the client's address. For a custom reverse proxy, strip client-supplied values before forwarding that header.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The unit suite tests file persistence, expiry, Redis command serialization with mocked HTTP responses, password checks, session tampering/expiry, and login rate limiting. It does not connect to a live Upstash database.

Run `node tests/local-smoke.mjs` for an isolated HTTP check. It creates a temporary development server on port 3199 with a random test password and cleans up afterward.

For HTTP checks against an isolated running instance, set `TEST_PASSWORD` to that instance's password and run `node tests/api.mjs`. Set `TEST_BASE_URL` if it runs somewhere other than `http://localhost:3000`. This check replaces and clears the instance's clipboard; use a dedicated Redis key or temporary local data directory.
