"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
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
  const [needsPlay, setNeedsPlay] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => setHostname(window.location.hostname), []);
  const embed = useMemo(() => src ? embedUrl(src, hostname) : null, [src, hostname]);
  useEffect(() => { setFailed(false); setNeedsPlay(false); setRetry(0); }, [src]);
  useEffect(() => {
    const video = ref.current;
    if (!video || !src || embed) return;
    video.load();
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return video.pause();
      void video.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true));
    }, { threshold: 0.2 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [src, embed, retry]);
  if (!src) return <div className="grid h-full min-h-[260px] place-items-center bg-black px-6 text-center text-sm text-muted">Video preview unavailable.</div>;
  if (embed) return <iframe src={embed} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="h-full min-h-[260px] w-full border-0 bg-black" />;
  if (failed) return <div className="grid h-full min-h-[260px] place-items-center bg-black px-6 text-center"><div><p className="text-sm text-muted">This device could not load the preview.</p><button type="button" onClick={() => { setFailed(false); setRetry((v) => v + 1); }} className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white"><RefreshCw size={13} /> Retry video</button></div></div>;
  return <div className="relative h-full min-h-[260px] bg-black"><video key={`${src}:${retry}`} ref={ref} src={src} aria-label={title} autoPlay muted loop playsInline preload="metadata" controls={needsPlay} disablePictureInPicture onCanPlay={() => setFailed(false)} onError={() => setFailed(true)} className="h-full min-h-[260px] w-full object-cover" />{needsPlay && <button type="button" onClick={() => void ref.current?.play().then(() => setNeedsPlay(false)).catch(() => undefined)} className="absolute inset-0 m-auto h-fit w-fit rounded-full bg-black/70 px-5 py-3 text-sm font-bold text-white backdrop-blur">Play preview</button>}</div>;
}
