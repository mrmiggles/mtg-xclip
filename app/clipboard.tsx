"use client";

import { useEffect, useRef, useState } from "react";
import type { Clipboard } from "@/lib/clipboard";

function Icon({ name }: { name: "copy" | "arrow" | "clip" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "copy" ? <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></> : name === "arrow" ? <><path d="M5 12h14m-5-5 5 5-5 5"/></> : <><rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/></>}
  </svg>;
}

export default function SharedClipboard({ ttlSeconds }: { ttlSeconds: number }) {
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const dirty = useRef(false);
  const busy = useRef(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    let fetching = false;
    async function sync() {
      if (dirty.current || busy.current || fetching) return;
      fetching = true;
      try {
        const response = await fetch("/api/clipboard", { cache: "no-store" });
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (!response.ok) throw new Error("Could not connect. Retrying automatically…");
        const value: Clipboard = await response.json();
        if (active && !dirty.current && !busy.current) {
          setText(value.text);
          setSavedText(value.text);
          setUpdatedAt(value.updatedAt);
          setLoaded(true);
          setError("");
        }
      } catch (error) {
        if (active) setError((error as Error).message);
      } finally { fetching = false; }
    }
    void sync();
    const interval = setInterval(sync, 2000);
    window.addEventListener("focus", sync);
    return () => { active = false; clearInterval(interval); window.removeEventListener("focus", sync); };
  }, []);

  useEffect(() => {
    if (!loaded || text === savedText || saving) return;
    const timer = setTimeout(async () => {
      busy.current = true;
      setSaving(true);
      setError("");
      try {
        const response = await fetch("/api/clipboard", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
        });
        if (response.status === 401) throw new Error("Your session expired. Open /login in another tab to sign in, then retry here.");
        if (!response.ok) throw new Error("Couldn't save your text. Check your connection and retry.");
        const value: Clipboard = await response.json();
        setSavedText(text);
        setUpdatedAt(value.updatedAt);
        dirty.current = editor.current?.value !== text;
      } catch (error) {
        setError((error as Error).message);
      } finally {
        busy.current = false;
        setSaving(false);
      }
    }, error ? 3000 : 600);
    return () => clearTimeout(timer);
  }, [text, savedText, loaded, saving, retry, error]);

  useEffect(() => {
    function protectUnsavedText(event: BeforeUnloadEvent) {
      if (dirty.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", protectUnsavedText);
    return () => window.removeEventListener("beforeunload", protectUnsavedText);
  }, []);

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Clipboard API needs HTTPS; selection also works on a local network over HTTP.
        editor.current?.focus();
        editor.current?.select();
        if (!document.execCommand("copy")) throw new Error("Select the text and copy it manually.");
      }
      setCopied(true);
    } catch { setError("Copy unavailable. Select the text and press Ctrl+C or ⌘C."); }
  }

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const pending = text !== savedText;
  const status = error ? "Connection issue" : !loaded ? "Connecting…" : saving || pending ? "Saving…" : "All changes saved";

  return <div className="shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="xclip home"><span className="brand-icon"><Icon name="clip"/></span>xclip<span className="brand-dot">.</span></a>
      <span className="topbar-note">A little space between devices</span>
      <span className="shared-badge"><span/>Shared clipboard</span>
      <form action="/api/logout" method="post"><button className="clear-button">Sign out</button></form>
    </header>
    <main>
      <div className="intro">
        <span className="eyebrow">COPY. PASTE. CARRY ON.</span>
        <h1>Here, there.<br/><span>Your text, anywhere.</span></h1>
        <p>A link, a note, that thing you need on your other screen.<br className="desktop-break"/> Paste it below. Open this page anywhere to pick it up.</p>
      </div>

      <section className="clipboard-card" aria-label="Shared clipboard">
        <div className="card-toolbar">
          <div className="card-title"><Icon name="clip"/><label htmlFor="clipboard">Your clipboard</label><span className="live-label">LIVE</span></div>
          <span className={`save-status ${error ? "has-error" : ""}`} role="status"><span className={saving || pending ? "status-dot pulsing" : "status-dot"}/>{status}</span>
        </div>
        <textarea id="clipboard" ref={editor} value={text} disabled={!loaded} maxLength={100000} spellCheck={false}
          placeholder={loaded ? "Drop a little something here…" : "Connecting to your clipboard…"}
          aria-describedby="clipboard-hint"
          onChange={(event) => { dirty.current = busy.current || event.target.value !== savedText; setText(event.target.value); setCopied(false); }} />
        <div className="card-footer">
          <div className="counts"><span>{text.length.toLocaleString()} characters</span><span className="count-divider">/</span><span>{text.trim() ? text.trim().split(/\s+/).length.toLocaleString() : 0} words</span></div>
          <div className="actions"><button className="clear-button" disabled={!loaded || !text} onClick={() => { dirty.current = busy.current || savedText !== ""; setText(""); editor.current?.focus(); }}>Clear</button>
          <button className="copy-button" disabled={!loaded || !text} onClick={copy}><Icon name="copy"/>{copied ? "Copied!" : "Copy text"}</button></div>
        </div>
      </section>
      {error && <div className="error-message" role="alert">{error}{pending && <button onClick={() => setRetry((value) => value + 1)}>Retry now</button>}</div>}
      <div className="under-card"><span id="clipboard-hint"><span className="small-spark">✧</span> Saves automatically. Syncs every 2 seconds.</span><span>{updatedAt ? `Last saved ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Ready when you are"}</span></div>

      <div className="how-it-works" aria-label="How it works">
        <div><span className="step-number">01</span><span>Paste something here</span></div><Icon name="arrow"/>
        <div><span className="step-number">02</span><span>Open on another browser</span></div><Icon name="arrow"/>
        <div><span className="step-number">03</span><span>Copy & carry on</span></div>
      </div>
    </main>
    <footer><span>Text expires {ttlSeconds >= 3600 ? `${Math.round(ttlSeconds / 3600 * 10) / 10} hours` : `${ttlSeconds} seconds`} after the last edit.</span><span>One shared space · Protected with a password</span></footer>
  </div>;
}
