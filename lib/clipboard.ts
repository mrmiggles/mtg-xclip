import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { clipboardKey, clipboardTTL, getRedis } from "./redis.ts";

export const MAX_LENGTH = 100_000;
export type Clipboard = { text: string; updatedAt: string | null };

function clipboardPath() {
  return path.join(process.env.CLIPBOARD_DATA_DIR || path.join(process.cwd(), "data"), "clipboard.json");
}

export async function readClipboard(): Promise<Clipboard> {
  const redis = getRedis();
  if (redis) return (await redis.get<Clipboard>(clipboardKey())) ?? { text: "", updatedAt: null };
  try {
    const value: Clipboard = JSON.parse(await readFile(clipboardPath(), "utf8"));
    if (value.updatedAt && Date.now() - Date.parse(value.updatedAt) >= clipboardTTL() * 1000) {
      return { text: "", updatedAt: null };
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { text: "", updatedAt: null };
    }
    throw error;
  }
}

// Serialize writes in this Node process; atomic renames keep readers from
// ever seeing a partially written JSON file.
let pending: Promise<unknown> = Promise.resolve();

export async function writeClipboard(text: string): Promise<Clipboard> {
  if (text.length > MAX_LENGTH) throw new Error("Text is too long.");
  const redis = getRedis();
  if (redis) {
    const value: Clipboard = { text, updatedAt: new Date().toISOString() };
    await redis.set(clipboardKey(), value, { ex: clipboardTTL() });
    return value;
  }
  const task = pending.then(async () => {
    const file = clipboardPath();
    const value: Clipboard = { text, updatedAt: new Date().toISOString() };
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, file);
    return value;
  });
  pending = task.catch(() => {});
  return task;
}
