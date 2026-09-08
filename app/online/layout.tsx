import type { ReactNode } from "react";
import { LiveStreamers } from "@/components/live-streamers";
export default function OnlineLayout({children}:{children:ReactNode}){return <div className="space-y-6"><LiveStreamers title="Streaming now" />{children}</div>;}
