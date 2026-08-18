"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAMERA_MODES } from "@/lib/camera-mode";

const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
const validThumbnailTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function ClipSubmitForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cameraMode, setCameraMode] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const uploadFile = async (file: File, folder: string) => {
    const response = await fetch("/api/clip-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        folder,
        fileSize: file.size,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload URL generation failed.");
    }

    const uploadResponse = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("File upload failed.");
    }

    return data.path;
  };

  const generateThumbnail = async (file: File): Promise<File> => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read the video to create a thumbnail."));
    });

    const duration = video.duration;
    const safeDuration = Number.isFinite(duration) && duration > 0.2 ? duration : 10;
    const target = Math.min(Math.max(safeDuration * (0.05 + Math.random() * 0.75), 0), safeDuration - 0.1);
    video.currentTime = target;

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
    if (!blob) throw new Error("Could not generate a thumbnail for this video.");
    return new File([blob], "auto-thumbnail.jpg", { type: "image/jpeg" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (title.length > 120) {
      setError("Title must be 120 characters or less.");
      return;
    }
    if (!videoFile) {
      setError("Please choose a video file to upload.");
      return;
    }
    if (!validVideoTypes.includes(videoFile.type)) {
      setError("Video must be MP4, WebM, or MOV.");
      return;
    }
    if (thumbnailFile && !validThumbnailTypes.includes(thumbnailFile.type)) {
      setError("Thumbnail must be PNG, JPG, JPEG, or WEBP.");
      return;
    }

    setLoading(true);

    try {
      const storagePath = await uploadFile(videoFile, "clips");

      let thumbnailPath: string | undefined;
      if (thumbnailFile) {
        thumbnailPath = await uploadFile(thumbnailFile, "thumbnails");
      } else {
        try {
          const autoThumbnail = await generateThumbnail(videoFile);
          thumbnailPath = await uploadFile(autoThumbnail, "thumbnails");
        } catch (thumbnailError) {
          console.warn("Auto thumbnail failed:", thumbnailError);
        }
      }

      const submitResponse = await fetch("/api/clips/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          cameraMode: cameraMode || null,
          storagePath,
          thumbnailPath,
        }),
      });

      const submitData = await submitResponse.json();
      if (!submitResponse.ok) {
        throw new Error(submitData.error || "Clip submission failed.");
      }

      setSuccess("Clip submitted! It will appear once approved.");
      setTitle("");
      setDescription("");
      setCameraMode("");
      setVideoFile(null);
      setThumbnailFile(null);
      router.refresh();
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div>
        <label className="block text-sm font-semibold text-white">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
          placeholder="Enter a catchy title"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-white">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
          placeholder="Share what makes this clip special..."
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-white">Camera mode</p>
        <p className="mt-1 text-xs text-muted">Shown on the post thumbnail so viewers know how it was captured.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CAMERA_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setCameraMode(mode.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                cameraMode === mode.value
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border bg-background/80 text-muted hover:border-accent/50 hover:text-white"
              }`}
            >
              {mode.emoji} {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-white">Video file</span>
          <input
            type="file"
            accept={validVideoTypes.join(",")}
            onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
            className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Thumbnail (optional)</span>
          <input
            type="file"
            accept={validThumbnailTypes.join(",")}
            onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
            className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Your clip will be submitted for review and published on approval.</p>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit clip"}
        </button>
      </div>
    </form>
  );
}
