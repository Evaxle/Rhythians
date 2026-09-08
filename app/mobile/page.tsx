import Link from "next/link";
import { ArrowRight, Bell, Download, Gauge, Map, MessageCircle, ShieldCheck, Smartphone, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { MobileAppInstall } from "@/components/mobile-app-install";

export const metadata = {
  title: "Rhythians Mobile App",
  description: "Install Rhythians on your phone as a fast standalone mobile web app.",
};

const features: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Trophy, title: "Battles & tournaments", text: "Join battles, follow brackets, and submit tournament results from your phone." },
  { icon: Map, title: "Maps", text: "Browse ranked maps, categories, daily maps, and your progression." },
  { icon: MessageCircle, title: "Community", text: "Use comments, messaging, profiles, clips, and community features." },
  { icon: Bell, title: "Standalone experience", text: "Launch from your home screen without the normal browser chrome." },
];

export default function MobilePage() {
  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-accent/20 bg-[radial-gradient(circle_at_12%_0%,rgba(124,143,240,0.25),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(85,214,160,0.12),transparent_28%),linear-gradient(145deg,rgba(20,27,45,0.98),rgba(8,12,22,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"><Smartphone size={14} /> Rhythians Mobile</span>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">Put Rhythians on your home screen.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">Install the full Rhythians website as a standalone mobile app with the same account, maps, battles, tournaments, clips, messages, and profile data.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/" className="ui-button border border-white/10 bg-white/5 text-white hover:border-accent/30 hover:bg-white/10">Open Rhythians <ArrowRight size={16} /></Link>
              <Link href="/login" className="ui-button border border-white/10 bg-white/5 text-white hover:border-accent/30 hover:bg-white/10">Sign in</Link>
            </div>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Install</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Rhythians Mobile App</h2>
            <p className="mt-2 text-sm leading-6 text-muted">No separate account or app store is required. The installed app stays connected to the same Rhythians service.</p>
            <div className="mt-5"><MobileAppInstall /></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }) => <div key={title} className="ui-card rounded-3xl p-5"><span className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent"><Icon size={21} /></span><h2 className="mt-4 font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{text}</p></div>)}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.05] p-5"><ShieldCheck size={21} className="text-emerald-300" /><p className="mt-3 font-semibold text-white">Same secure login</p><p className="mt-2 text-sm leading-6 text-muted">Your normal Rhythians session and account security continue to work inside the installed app.</p></div>
        <div className="rounded-3xl border border-sky-400/15 bg-sky-400/[0.05] p-5"><Gauge size={21} className="text-sky-300" /><p className="mt-3 font-semibold text-white">Mobile optimized</p><p className="mt-2 text-sm leading-6 text-muted">The existing responsive navigation and layouts automatically switch to the mobile interface.</p></div>
        <div className="rounded-3xl border border-violet-400/15 bg-violet-400/[0.05] p-5"><Sparkles size={21} className="text-violet-300" /><p className="mt-3 font-semibold text-white">Always current</p><p className="mt-2 text-sm leading-6 text-muted">Because it uses the live Rhythians site, new features appear without downloading a new app package.</p></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/10 p-5 sm:p-6">
        <div className="flex items-start gap-3"><Download size={19} className="mt-0.5 shrink-0 text-accent" /><div><p className="font-semibold text-white">About the download</p><p className="mt-2 text-sm leading-6 text-muted">Rhythians Mobile is an installable web app, not an Android APK or iOS App Store binary. That means the install button uses your browser&apos;s secure web-app installation system and opens Rhythians in its own app window.</p></div></div>
      </section>
    </div>
  );
}
