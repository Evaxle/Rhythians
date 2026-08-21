"use client";

import { useEffect, useRef } from "react";
import "plyr/dist/plyr.css";

export function ClipPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let player: { destroy: () => void } | undefined;
    let cancelled = false;

    void import("plyr").then(({ default: Plyr }) => {
      if (cancelled || !videoRef.current) return;
      player = new Plyr(videoRef.current, {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "duration",
          "mute",
          "volume",
          "settings",
          "pip",
          "airplay",
          "fullscreen",
        ],
        settings: ["quality", "speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      playsInline
      className="h-full w-full object-contain"
    />
  );
}
