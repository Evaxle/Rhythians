"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, User as UserIcon, BookOpen, Video, Megaphone, Shield, Loader2, MessageCircle, UserPlus } from "lucide-react";
import type { UserLite } from "@/components/messages/types";
import { userAvatarUrl, getAvatarInitial } from "@/components/messages/types";

type SearchResults = {
  users: UserLite[];
  articles: Array<{ id: string; title: string; slug: string; description: string; category: { slug: string; name: string } }>;
  clips: Array<{ id: string; title: string; description: string; category: { name: string } | null }>;
  announcements: Array<{ id: string; title: string; slug: string; createdAt: string }>;
  rules: Array<{ id: string; title: string; slug: string }>;
};

function UserAvatar({ user }: { user: UserLite }) {
  const avatarUrl = userAvatarUrl(user);
  if (avatarUrl) {
    return <img src={avatarUrl} alt={user.username} className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
      {getAvatarInitial(user)}
    </span>
  );
}

function UserResult({ user }: { user: UserLite }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/friends/status?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setStatus(data.status ?? "none"))
      .catch(() => setStatus("none"));
  }, [user.id]);

  async function sendRequest() {
    setBusy(true);
    try {
      const response = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      setStatus(data.status ?? "none");
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
      <UserAvatar user={user} />
      <Link href={`/profile/${user.profileHandle}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white hover:text-accent">{user.username}</p>
        <p className="truncate text-xs text-muted">@{user.profileHandle}</p>
      </Link>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/messages?user=${encodeURIComponent(user.profileHandle)}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent2"
        >
          <MessageCircle size={12} /> Message
        </Link>
        {status === "friends" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
            <UserPlus size={12} /> Friends
          </span>
        )}
        {status === "outgoing_pending" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted">
            Request sent
          </span>
        )}
        {status === "incoming_pending" && (
          <button
            type="button"
            onClick={sendRequest}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Accept
          </button>
        )}
        {status === "none" && (
          <button
            type="button"
            onClick={sendRequest}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Add friend
          </button>
        )}
      </div>
    </div>
  );
}

function Section<T>({
  title,
  icon,
  items,
  render,
}: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
        {icon} {title}
      </div>
      <div className="space-y-2">{items.map(render)}</div>
    </section>
  );
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ users: [], articles: [], clips: [], announcements: [], rules: [] });
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ users: [], articles: [], clips: [], announcements: [], rules: [] });
      setSearched(false);
      return;
    }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          setResults(data);
          setSearched(true);
        })
        .catch(() => setSearched(true))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [query]);

  const total = results.users.length + results.articles.length + results.clips.length + results.announcements.length + results.rules.length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h1 className="text-3xl font-semibold text-white">Search</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Search users, articles, clips, announcements, and rules across the community platform.</p>
        <div className="mt-6">
          <label htmlFor="search-input" className="sr-only">Search</label>
          <div className="flex items-center gap-2 rounded-3xl border border-border bg-background/70 px-4 py-3 transition focus-within:border-accent">
            <Search size={18} className="shrink-0 text-muted" />
            <input
              id="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              className="w-full bg-transparent text-white outline-none placeholder:text-muted"
              placeholder="Search users, knowledge, clips..."
            />
            {searching && <Loader2 size={16} className="shrink-0 animate-spin text-muted" />}
          </div>
        </div>
      </section>

      {!searched && !searching ? (
        <div className="rounded-3xl border border-border bg-surface/95 p-10 text-center text-sm text-muted">
          Start typing to search across the community platform.
        </div>
      ) : searched && total === 0 ? (
        <div className="rounded-3xl border border-border bg-surface/95 p-10 text-center text-sm text-muted">
          No results found for &ldquo;{query.trim()}&rdquo;.
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            title={`Users (${results.users.length})`}
            icon={<UserIcon size={15} />}
            items={results.users}
            render={(user) => <UserResult key={user.id} user={user} />}
          />
          <Section
            title={`Knowledge (${results.articles.length})`}
            icon={<BookOpen size={15} />}
            items={results.articles}
            render={(article) => (
              <Link
                key={article.id}
                href={`/knowledge/${article.category.slug}`}
                className="block rounded-2xl border border-border bg-background/70 px-4 py-3 transition hover:border-accent/40"
              >
                <p className="text-sm font-semibold text-white">{article.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{article.category.name} — {article.description}</p>
              </Link>
            )}
          />
          <Section
            title={`Clips (${results.clips.length})`}
            icon={<Video size={15} />}
            items={results.clips}
            render={(clip) => (
              <Link
                key={clip.id}
                href={`/clips/${clip.id}`}
                className="block rounded-2xl border border-border bg-background/70 px-4 py-3 transition hover:border-accent/40"
              >
                <p className="text-sm font-semibold text-white">{clip.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{clip.category?.name ?? "Clip"}</p>
              </Link>
            )}
          />
          <Section
            title={`Announcements (${results.announcements.length})`}
            icon={<Megaphone size={15} />}
            items={results.announcements}
            render={(announcement) => (
              <Link
                key={announcement.id}
                href={`/announcements/${announcement.slug}`}
                className="block rounded-2xl border border-border bg-background/70 px-4 py-3 transition hover:border-accent/40"
              >
                <p className="text-sm font-semibold text-white">{announcement.title}</p>
                <p className="mt-1 text-xs text-muted">{new Date(announcement.createdAt).toLocaleDateString()}</p>
              </Link>
            )}
          />
          <Section
            title={`Rules (${results.rules.length})`}
            icon={<Shield size={15} />}
            items={results.rules}
            render={(rule) => (
              <Link
                key={rule.id}
                href={`/rules#${rule.slug}`}
                className="block rounded-2xl border border-border bg-background/70 px-4 py-3 transition hover:border-accent/40"
              >
                <p className="text-sm font-semibold text-white">{rule.title}</p>
              </Link>
            )}
          />
        </div>
      )}
    </div>
  );
}
