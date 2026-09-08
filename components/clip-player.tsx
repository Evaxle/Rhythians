"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tiktokVideoId, twitchClipSlug, youtubeVideoId } from "@/lib/clip-source";
import "plyr/dist/plyr.css";

function externalEmbed(src: string, hostname: string | null) {
  const youtube = youtubeVideoId(src);
  if (youtube) return { type: "youtube", url: `https://www.youtube.com/embed/${youtube}?rel=0` };
  const tiktok = tiktokVideoId(src);
  if (tiktok) return { type: "tiktok", url: `https://www.tiktok.com/player/v1/${tiktok}?autoplay=0` };
  const twitch = twitchClipSlug(src);
  if (twitch) return { type: "twitch", url: hostname ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(twitch)}&parent=${encodeURIComponent(hostname)}&autoplay=false` : null };
  return null;
}

export function ClipPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => setHostname(window.location.hostname), []);
  const embed = useMemo(() => externalEmbed(src, hostname), [src, hostname]);

  useEffect(() => {
    if (embed) return;
    let player: { destroy: () => void } | undefined;
    let cancelled = false;
    void import("plyr").then(({ default: Plyr }) => {
      if (cancelled || !videoRef.current) return;
      player = new Plyr(videoRef.current, {
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "settings", "pip", "airplay", "fullscreen"],
        settings: ["quality", "speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      });
    });
    return () => { cancelled = true; player?.destroy(); };
  }, [embed]);

  if (embed) {
    if (!embed.url) return <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-muted">Loading Twitch clip…</div>;
    return <iframe src={embed.url} title={`${embed.type} clip`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full min-h-[300px] w-full border-0" />;
  }

  return <video ref={videoRef} src={src} playsInline className="h-full w-full object-contain" />;
}
