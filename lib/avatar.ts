export interface AvatarUser {
  avatar?: string | null;
  discordId?: string | null;
}

function normalizedSize(size: number) {
  const allowed = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const requested = Number.isFinite(size) ? Math.max(16, Math.min(4096, Math.round(size))) : 128;
  return allowed.find((value) => value >= requested) ?? 4096;
}

export function getAvatarUrl(user: AvatarUser, size = 128): string | null {
  const avatar = user.avatar?.trim();
  if (!avatar) return null;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  if (!user.discordId) return null;
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.discordId)}/${encodeURIComponent(avatar)}.webp?size=${normalizedSize(size)}`;
}
