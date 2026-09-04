import Link from "next/link";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/clips";
import { cameraModeLabel, cameraModeEmoji } from "@/lib/camera-mode";
import { getSessionUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";
import { Music, Tag as TagIcon, Search, Upload, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ song?: string; tag?: string; friend?: string }> };

type Friend = {
  id: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  discordId: string | null;
};

export default async function ClipsPage({ searchParams }: Props) {
  const params = await searchParams;
  const song = typeof params?.song === "string" ? params.song.trim() : "";
  const tag = typeof params?.tag === "string" ? params.tag.trim() : "";
  const friend = typeof params?.friend === "string" ? params.friend.trim() : "";
  const user = await getSessionUser();

  let friends: Friend[] = [];
  if (user) {
    const relationships = await prisma.friendRequest.findMany({ where: { status: "accepted", OR: [{ senderId: user.id }, { receiverId: user.id }] }, select: { senderId: true, receiverId: true } });
    const friendIds = [...new Set(relationships.map((entry) => entry.senderId === user.id ? entry.receiverId : entry.senderId))];
    if (friendIds.length > 0) friends = await prisma.user.findMany({ where: { id: { in: friendIds } }, select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, discordId: true }, orderBy: { username: "asc" } });
  }

  const selectedFriend = friends.find((entry) => entry.profileHandle === friend) ?? (user && user.profileHandle === friend ? user : null);
  const where: Record<string, unknown> = { status: "approved" };
  if (song) where.songName = { contains: song, mode: "insensitive" };
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  if (selectedFriend) where.uploaderId = selectedFriend.id;

  const clips = await prisma.clip.findMany({ where, orderBy: { createdAt: "desc" }, include: { uploader: true, category: true, reviewedBy: { select: { username: true, discriminator: true, displayName: true } }, tags: { include: { tag: true } } }, take: 12 });
  const clipsWithThumbs = await Promise.all(clips.map(async (clip) => ({ ...clip, thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath) })));
  const filterLabel = song ? `song: ${song}` : tag ? `tag: ${tag}` : selectedFriend ? `creator: ${selectedFriend.displayName ?? selectedFriend.username}` : "";
  const allHref = song || tag ? `/clips?${new URLSearchParams({ ...(song ? { song } : {}), ...(tag ? { tag } : {}) }).toString()}` : "/clips";

  return <div className="ui-page space-y-5">
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(124,143,240,0.16),transparent_28%),radial-gradient(circle_at_95%_100%,rgba(56,189,248,0.08),transparent_26%),linear-gradient(145deg,rgba(20,27,45,0.95),rgba(10,14,25,0.97))] p-5 shadow-glow sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><p className="ui-kicker text-accent">Clips</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Watch the community.</h1><p className="mt-2 text-sm leading-6 text-muted">Browse highlights, runs, and creator uploads in a familiar video-first layout.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/clips" className="flex min-w-0 items-center rounded-2xl border border-white/10 bg-black/20 p-1.5 sm:w-[360px]"><Search size={17} className="ml-2 shrink-0 text-muted" /><input name="song" defaultValue={song} placeholder="Search by song..." className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none focus:border-0 focus:ring-0" /><button type="submit" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">Search</button></form>
        <Link href="/clips/submit" className="ui-button shrink-0 bg-accent text-white hover:bg-accent2"><Upload size={16} /> Upload</Link>
      </div></div>
      {filterLabel && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 font-semibold text-accent">{filterLabel}</span><Link href={allHref} className="text-muted hover:text-white">Clear filters</Link></div>}
    </section>

    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="ui-card h-fit rounded-3xl p-4 lg:sticky lg:top-24">
        <div className="flex items-center gap-2 px-2"><Users size={16} className="text-accent" /><h2 className="text-sm font-semibold text-white">Creators you know</h2></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">{user && <Link href="/clips" className={`flex shrink-0 items-center gap-3 rounded-2xl p-2.5 transition ${!selectedFriend ? "bg-accent/10 text-white" : "hover:bg-white/5"}`}><div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{user.username.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">All creators</p><p className="text-[11px] text-muted">Everyone</p></div></Link>}{friends.map((friendEntry) => { const avatar = getAvatarUrl(friendEntry, 64); const active = selectedFriend?.id === friendEntry.id; return <Link key={friendEntry.id} href={`/clips?friend=${encodeURIComponent(friendEntry.profileHandle)}${song ? `&song=${encodeURIComponent(song)}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`} className={`flex shrink-0 items-center gap-3 rounded-2xl p-2.5 transition ${active ? "bg-accent/10" : "hover:bg-white/5"}`}><div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-accent/10">{avatar ? <><img src={avatar} alt={friendEntry.displayName ?? friendEntry.username} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.parentElement?.querySelector("[data-avatar-fallback]"); if (fallback) fallback.classList.remove("hidden"); }} /><span data-avatar-fallback className="hidden h-full w-full items-center justify-center text-xs font-bold text-accent">{friendEntry.username.charAt(0).toUpperCase()}</span></> : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-accent">{friendEntry.username.charAt(0).toUpperCase()}</span>}</div><div className="min-w-0"><p className={`truncate text-sm font-semibold ${active ? "text-accent" : "text-white"}`}>{friendEntry.displayName ?? friendEntry.username}</p><p className="truncate text-[11px] text-muted">@{friendEntry.profileHandle}</p></div></Link>})}{friends.length === 0 && !user && <p className="px-2 py-3 text-xs leading-5 text-muted">Sign in and add friends to filter clips by creators you know.</p>}{friends.length === 0 && user && <p className="px-2 py-3 text-xs leading-5 text-muted">Add friends to build your creator feed.</p>}</div>
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between"><div><p className="ui-kicker text-muted">Video feed</p><h2 className="mt-1 text-xl font-semibold text-white">{selectedFriend ? `${selectedFriend.displayName ?? selectedFriend.username}'s clips` : "Latest uploads"}</h2></div><span className="text-xs text-muted">{clipsWithThumbs.length} shown</span></div>
        {clipsWithThumbs.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-12 text-center text-sm text-muted">{song || tag || selectedFriend ? "No clips match this feed yet." : "No approved clips are available yet."}</div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{clipsWithThumbs.map((clip) => { const modeLabel = cameraModeLabel(clip.cameraMode); const modeEmoji = cameraModeEmoji(clip.cameraMode); const avatar = getAvatarUrl(clip.uploader, 64); return <Link key={clip.id} href={`/clips/${clip.id}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-surface/80 shadow-glow transition duration-300 hover:-translate-y-1 hover:border-accent/25 hover:shadow-2xl"><div className="relative aspect-video overflow-hidden bg-white/5">{clip.thumbnailUrl ? <img src={clip.thumbnailUrl} alt={clip.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-xs text-muted">No thumbnail</div>}{modeLabel && <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent backdrop-blur">{modeEmoji} {modeLabel}</span>}</div><div className="p-4"><div className="flex items-center gap-2"><div className="h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-accent/10">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-accent">{clip.uploader.username.charAt(0).toUpperCase()}</span>}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{clip.uploader.displayName ?? clip.uploader.username}</p><p className="text-[10px] text-muted">{clip.createdAt.toLocaleDateString()}</p></div></div><h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-white transition group-hover:text-accent">{clip.title}</h3>{clip.songName && <p className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent"><Music size={11} /> {clip.songName}</p>}{clip.tags.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{clip.tags.slice(0, 3).map(({ tag: clipTag }) => <span key={clipTag.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted"><TagIcon className="h-3 w-3" /> {clipTag.name}</span>)}</p>}</div></Link>; })}</div>}
      </section>
    </div>
  </div>;
}
