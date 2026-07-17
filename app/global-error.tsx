"use client";

import { useEffect } from "react";

/**
 * Root error boundary — the last line of defense. Replaces the root layout when
 * an error is thrown in the layout itself (or anywhere the [locale] boundary
 * can't catch), so it must render its own <html>/<body> and cannot rely on the
 * theme provider, fonts, or i18n context (any of which may be what failed).
 * Styling is therefore inline and copy is static English.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b0f14",
          color: "#e5e7eb",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#9ca3af", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
            An unexpected error occurred. You can try again, or return to the
            homepage.
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={reset}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.55rem 1.1rem",
                fontSize: "0.95rem",
                fontWeight: 500,
                background: "#16a34a",
                color: "#ffffff",
              }}
            >
              Try again
            </button>
            {/* Intentional hard navigation, not next/link: a full reload from
                the root error boundary clears the broken client state that
                caused the crash, which a soft client-side nav would keep. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                textDecoration: "none",
                borderRadius: "0.5rem",
                padding: "0.55rem 1.1rem",
                fontSize: "0.95rem",
                fontWeight: 500,
                border: "1px solid #374151",
                color: "#e5e7eb",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
