"use client";

import { useState } from "react";

/**
 * The only client-side JavaScript on the page: native Web Share with a
 * copy-to-clipboard fallback.
 */
export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch {
        // User dismissed the share sheet, or it failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (very old browser / permissions) — do nothing.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full border border-line px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
