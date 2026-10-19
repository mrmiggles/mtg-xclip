import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_LENGTH, readClipboard, writeClipboard } from "../lib/clipboard.ts";

const directory = await mkdtemp(path.join(tmpdir(), "xclip-test-"));
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
Object.assign(process.env, { NODE_ENV: "test" });
process.env.CLIPBOARD_TTL_SECONDS = "86400";
process.env.CLIPBOARD_DATA_DIR = directory;
after(async () => { await rm(directory, { recursive: true, force: true }); });

test("new clipboard starts empty", async () => {
  assert.deepEqual(await readClipboard(), { text: "", updatedAt: null });
});

test("text persists with whitespace, Unicode and a timestamp", async () => {
  const text = "  Hello 👋\n\nhttps://example.com\t ";
  const saved = await writeClipboard(text);
  assert.equal(saved.text, text);
  assert.ok(saved.updatedAt && !Number.isNaN(Date.parse(saved.updatedAt)));
  assert.deepEqual(await readClipboard(), saved);
});

test("concurrent writes remain readable and the final write wins", async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => writeClipboard(`Message ${i}`)));
  assert.equal((await readClipboard()).text, "Message 19");
});

test("clearing persists an empty string", async () => {
  await writeClipboard("");
  assert.equal((await readClipboard()).text, "");
});

test("oversized text is rejected without changing stored content", async () => {
  await assert.rejects(writeClipboard("x".repeat(MAX_LENGTH + 1)), /too long/);
  assert.equal((await readClipboard()).text, "");
});

test("expired local clipboard reads as empty", async () => {
  await writeFile(path.join(directory, "clipboard.json"), JSON.stringify({
    text: "expired", updatedAt: new Date(Date.now() - 86401_000).toISOString(),
  }));
  assert.deepEqual(await readClipboard(), { text: "", updatedAt: null });
});
