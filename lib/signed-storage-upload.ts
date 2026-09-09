export async function uploadFileToSignedStorageUrl(url: string, file: File) {
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", file);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: form,
  });
  if (response.ok) return;
  const data = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  const message = data?.message || data?.error || `Storage upload failed with HTTP ${response.status}.`;
  throw new Error(message);
}
