import { redirect } from "next/navigation";
import { authenticated } from "@/lib/access";

const messages: Record<string, string> = {
  invalid: "That password didn't match. Try again.",
  limited: "Too many attempts. Try again in 10 minutes.",
  configuration: "Set CLIPBOARD_PASSWORD on the server to enable access.",
  unavailable: "Sign-in is temporarily unavailable. Check the server's Redis configuration.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await authenticated()) redirect("/");
  const { error } = await searchParams;
  const message = !process.env.CLIPBOARD_PASSWORD ? messages.configuration : error ? messages[error] : null;
  return <main className="login-shell">
    <a href="/" className="brand">xclip<span className="brand-dot">.</span></a>
    <div className="login-card">
      <span className="eyebrow">YOUR SHARED SPACE</span>
      <h1>A password.<br/><span>Then you're in.</span></h1>
      <p>Enter the shared password to open your clipboard.</p>
      <form action="/api/login" method="post">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} autoFocus />
        {message && <p className="error-message" role="alert">{message}</p>}
        <button className="copy-button" type="submit">Open clipboard <span aria-hidden="true">→</span></button>
      </form>
    </div>
    <p className="login-note">One clipboard, across your browsers and devices.</p>
  </main>;
}
