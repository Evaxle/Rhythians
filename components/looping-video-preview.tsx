"use client";

import { useEffect, useRef, useState } from "react";

export function LoopingVideoPreview({ src, title }: { src: string | null; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  if (!src || failed) {
    return <div className="grid h-full min-h-[260px] place-items-center bg-black px-6 text-center text-sm text-muted">Video preview unavailable.</div>;
  }

  return (
    <video
      ref={ref}
      src={src}
      aria-label={title}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={() => setFailed(true)}
      className="h-full min-h-[260px] w-full object-cover"
    />
  );
}
