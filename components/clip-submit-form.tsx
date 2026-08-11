"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClipCategory = {
  id: string;
  name: string;
};

type Tag = {
  id: string;
  name: string;
};

type Props = {
  categories: ClipCategory[];
  tags: Tag[];
};

const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
const validThumbnailTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function ClipSubmitForm({ categories, tags }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

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
    if (!categoryId) {
      setError("Please select a category.");
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
      }

      const submitResponse = await fetch("/api/clips/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryId,
          tagIds: selectedTags,
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
      setCategoryId(categories[0]?.id ?? "");
      setSelectedTags([]);
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
      <div className="grid gap-6 lg:grid-cols-2">
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
          <label className="block text-sm font-semibold text-white">Category</label>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
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
        <p className="text-sm font-semibold text-white">Tags</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagToggle(tag.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${selectedTags.includes(tag.id)
                ? "border-accent bg-accent/10 text-white"
                : "border-border bg-background/80 text-muted"
              }`}
            >
              {tag.name}
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
