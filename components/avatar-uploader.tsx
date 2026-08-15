"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

export function AvatarUploader({
  avatarUrl,
  username,
}: {
  avatarUrl: string | null;
  username: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not upload your image.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-5">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${username}'s avatar`}
          className="h-20 w-20 rounded-full border-2 border-accent/30 object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 text-2xl font-bold text-accent">
          {username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="space-y-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-white transition hover:border-accent/40 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {busy ? "Uploading..." : "Upload profile picture"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <p className="text-xs text-muted">PNG, JPEG, WebP, or GIF. Max 5 MB.</p>
      </div>
    </div>
  );
}
