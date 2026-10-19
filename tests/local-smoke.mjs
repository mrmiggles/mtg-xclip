import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Isolated dev server, data directory, and random password; no real Redis data.
const directory = await mkdtemp(path.join(tmpdir(), "xclip-http-"));
const password = randomBytes(32).toString("hex");
const port = "3199";
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, NODE_ENV: "development", CLIPBOARD_PASSWORD: password,
  CLIPBOARD_DATA_DIR: directory, UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "",
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], { env, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (value) => { output += value; });
server.stderr.on("data", (value) => { output += value; });

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(200);
  }
  if (!ready) throw new Error(`Server did not become ready: ${output}`);
  const check = spawn(process.execPath, ["tests/api.mjs"], {
    env: { ...env, TEST_BASE_URL: base, TEST_PASSWORD: password }, stdio: "inherit",
  });
  const code = await new Promise((resolve) => check.once("exit", resolve));
  if (code !== 0) throw new Error("HTTP checks failed.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(5000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  await rm(directory, { recursive: true, force: true });
}
