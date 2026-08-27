import { extensionFromMapUrl } from "@/lib/rhythkit-map-file";
import { supabaseAdmin } from "@/lib/supabase";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";

export async function resolveRhythKitMapSource(value: string) {
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const name = decodeURIComponent(url.pathname.split("/").pop() ?? "map.sspm");
    return { url: value, extension: extensionFromMapUrl(value), originalName: name };
  }
  if (!supabaseAdmin) throw new Error("Storage service is not configured.");
  const { data, error } = await supabaseAdmin.storage.from(bucket()).createSignedUrl(value, 300);
  if (error || !data?.signedUrl) throw new Error("Map file is unavailable.");
  const extension = value.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return { url: data.signedUrl, extension: extension === "rhm" ? ".rhm" : ".sspm", originalName: value.split("/").pop() ?? "map.sspm" };
}
