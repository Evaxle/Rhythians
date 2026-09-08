"use client";
import { usePathname } from "next/navigation";
import { LiveStreamers } from "@/components/live-streamers";
export function LiveStreamerPlacement(){const pathname=usePathname();if(pathname!=="/")return null;return <div className="mb-7"><LiveStreamers title="Rhythians live now" /></div>;}
