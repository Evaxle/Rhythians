export interface AvatarUser {
  avatar?: string | null;
  discordId?: string | null;
}

export function getAvatarUrl(user: AvatarUser, size = 128): string | null {
  if (!user.avatar) return null;
  if (user.avatar.startsWith("http://") || user.avatar.startsWith("https://")) {
    return user.avatar;
  }
  if (user.discordId) {
    return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=${size}`;
  }
  return null;
}
