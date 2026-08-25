import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleDot, RotateCw, MoveDiagonal } from "lucide-react";
import { getSessionUser, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { VibroVideoManager } from "@/components/wiki/vibro-video-manager";

const settingKey = "wiki_vibro_videos";
const kinds = ["linear", "spin", "mouse_swiveling", "cheesing"] as const;
type Kind = (typeof kinds)[number];

async function getVideos(): Promise<Partial<Record<Kind, string>>> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey }, select: { value: true } });
  if (!setting?.value) return {};
  try {
    const value = JSON.parse(setting.value) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Partial<Record<Kind, string>>;
  } catch {
    return {};
  }
}

const techniques = [
  { id: "linear", title: "Linear", icon: MoveDiagonal, text: "Linear Vibro is a straight-line motion in any direction: sideways, up and down, or diagonally. The mouse movement stays along a direct path rather than rotating around a point." },
  { id: "spin", title: "Spin", icon: RotateCw, text: "Spin is Vibro performed by spinning the mouse in a circle while using a looser grip on the mouse. The circular motion is continuous and controlled rather than a straight-line shake." },
  { id: "mouse_swiveling", title: "Mouse Swiveling", icon: CircleDot, text: "Mouse Swiveling is Vibro performed while changing the direction of the motion using your fingertips. The mouse is repeatedly swiveled through different Vibro directions while maintaining control." },
  { id: "cheesing", title: "Cheesing", icon: CircleAlert, text: "Cheesing is not Vibro. It is a technique where the player performs slow jumps while getting just enough hits to remain alive. It is listed separately so it is not confused with actual Vibro techniques." },
] as const;

export default async function VibroWikiPage() {
  const user = await getSessionUser();
  const owner = isOwner(user);
  const videos = await getVideos();

  return <div className="space-y-7"><Link href="/wiki" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent"><ArrowLeft size={16} /> Back to Wiki</Link><section className="overflow-hidden rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><p className="text-sm uppercase tracking-[0.3em] text-accent">Wiki · Vibro</p><h1 className="mt-3 text-4xl font-black text-white">Vibro Techniques</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-muted">A guide to the main Vibro techniques used in Rhythia, with demonstration videos maintained by the site owner.</p></section><div className="grid gap-5">{techniques.map((technique) => { const Icon = technique.icon; const video = videos[technique.id]; return <article key={technique.id} className={`grid overflow-hidden rounded-3xl border bg-surface/95 shadow-glow lg:grid-cols-[1fr_420px] ${technique.id === "cheesing" ? "border-red-400/35" : "border-border"}`}><div className="p-7"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${technique.id === "cheesing" ? "bg-red-400/15 text-red-300" : "bg-accent/15 text-accent"}`}><Icon size={22} /></div><div><h2 className="text-2xl font-black text-white">{technique.title}</h2>{technique.id === "cheesing" && <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-red-300">Not Vibro · Cheat notice</p>}</div></div><p className="mt-5 text-sm leading-7 text-muted">{technique.text}</p></div><div className="border-t border-border bg-background/50 p-4 lg:border-l lg:border-t-0">{video ? <video controls preload="metadata" src={video} className="aspect-video w-full rounded-2xl object-cover" /> : <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-surface text-sm text-muted">No demonstration video uploaded yet.</div>}</div></article>})}</div>{owner && <VibroVideoManager initialVideos={videos} />}</div>;
}
