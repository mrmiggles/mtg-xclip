import { cookies } from "next/headers";
import { SESSION_COOKIE, validSession } from "./auth";

export async function authenticated(): Promise<boolean> {
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireAccess(): Promise<Response | null> {
  const headers = { "Cache-Control": "no-store" };
  if (!process.env.CLIPBOARD_PASSWORD) {
    return Response.json({ error: "Server password is not configured." }, { status: 503, headers });
  }
  if (!await authenticated()) {
    return Response.json({ error: "Please sign in to use the clipboard." }, { status: 401, headers });
  }
  return null;
}
