import { NextResponse } from "next/server";
import { createSession, passwordMatches, sameOrigin, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/auth";
import { allowLogin } from "@/lib/login-limit";

export const runtime = "nodejs";

function result(error: string) {
  // Relative Location keeps redirects correct behind a hosting reverse proxy.
  return new Response(null, { status: 303, headers: { Location: `/login?error=${error}`, "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Origin not allowed.", { status: 403 });
  if (!process.env.CLIPBOARD_PASSWORD) return result("configuration");
  try {
    if (!await allowLogin(request)) return result("limited");
  } catch { return result("unavailable"); }
  let password: FormDataEntryValue | null;
  try { password = (await request.formData()).get("password"); }
  catch { return result("invalid"); }
  if (typeof password !== "string" || password.length > 1024 || !passwordMatches(password)) {
    return result("invalid");
  }
  const response = new NextResponse(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: SESSION_SECONDS,
  });
  return response;
}
