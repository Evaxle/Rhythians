"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0f19", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px" }}>⚠️</div>
          <h1 style={{ fontSize: "24px", margin: 0 }}>Something went wrong</h1>
          <p style={{ maxWidth: "480px", fontSize: "14px", lineHeight: 1.6, color: "#9ca3af" }}>
            The app hit a server error. This is usually caused by a missing environment variable
            (like <code>DATABASE_URL</code>) or the database being unreachable. Check the Vercel
            function logs for details.
          </p>
          {error?.message && (
            <pre
              style={{
                maxWidth: "560px",
                overflow: "auto",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "12px",
                fontSize: "12px",
                color: "#fca5a5",
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: "9999px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
