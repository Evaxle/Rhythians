"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { medalClipId, tiktokVideoId, twitchClipSlug, youtubeVideoId } from "@/lib/clip-source";

function embedUrl(src: string, hostname: string | null) {
  const youtube = youtubeVideoId(src);
  if (youtube) return `https://www.youtube.com/embed/${youtube}?autoplay=1&mute=1&loop=1&playlist=${youtube}&controls=0&rel=0`;
  const tiktok = tiktokVideoId(src);
  if (tiktok) return `https://www.tiktok.com/player/v1/${tiktok}?autoplay=1&loop=1&mute=1&controls=0`;
  const twitch = twitchClipSlug(src);
  if (twitch && hostname) return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(twitch)}&parent=${encodeURIComponent(hostname)}&autoplay=true&muted=true`;
  const medal = medalClipId(src);
  if (medal) return `https://medal.tv/clip/${encodeURIComponent(medal)}?autoplay=1&muted=1`;
  return null;
}

export function LoopingVideoPreview({ src, title }: { src: string | null; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => setHostname(window.location.hostname), []);
  const embed = useMemo(() => src ? embedUrl(src, hostname) : null, [src, hostname]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src || embed) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: 0.2 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [src, embed]);

  if (!src || failed) return <div className="grid h-full min-h-[260px] place-items-center bg-black px-6 text-center text-sm text-muted">Video preview unavailable.</div>;
  if (embed) return <iframe src={embed} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="h-full min-h-[260px] w-full border-0 bg-black" />;

  return <video ref={ref} src={src} aria-label={title} autoPlay muted loop playsInline preload="auto" disablePictureInPicture onError={() => setFailed(true)} className="h-full min-h-[260px] w-full object-cover" />;
}
