import { MAX_LENGTH, readClipboard, writeClipboard } from "@/lib/clipboard";
import { requireAccess } from "@/lib/access";
import { sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const denied = await requireAccess();
  if (denied) return denied;
  try {
    return Response.json(await readClipboard(), { headers });
  } catch {
    return Response.json({ error: "Could not load the clipboard." }, { status: 500, headers });
  }
}

export async function PUT(request: Request) {
  const denied = await requireAccess();
  if (denied) return denied;
  // Prevent another website from writing via a visitor's browser.
  if (!sameOrigin(request)) {
    return Response.json({ error: "Origin not allowed." }, { status: 403, headers });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON with a text field." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string") {
    return Response.json({ error: "Text must be a string." }, { status: 400, headers });
  }
  if (body.text.length > MAX_LENGTH) {
    return Response.json({ error: "The clipboard holds up to 100,000 characters." }, { status: 413, headers });
  }
  try {
    return Response.json(await writeClipboard(body.text), { headers });
  } catch {
    return Response.json({ error: "Could not save the clipboard." }, { status: 500, headers });
  }
}
