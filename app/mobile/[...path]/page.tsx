import { notFound } from "next/navigation";
import { MobilePage } from "@/components/mobile-page";
import Home from "@/app/page";
import Daily from "@/app/daily/mobile";
import Path from "@/app/path/mobile";
import Maps from "@/app/maps/mobile";
import Battles from "@/app/battles/mobile";
import Online from "@/app/online/mobile";
import Wiki from "@/app/wiki/mobile";
import Leaderboards from "@/app/leaderboards/mobile";
import Clips from "@/app/clips/mobile";
import Rules from "@/app/rules/mobile";
import CommunitySettings from "@/app/community-settings/mobile";
import Messages from "@/app/messages/mobile";
import Notifications from "@/app/notifications/mobile";
import Settings from "@/app/settings/mobile";
import Search from "@/app/search/mobile";
import Login from "@/app/login/mobile";
import Register from "@/app/register/mobile";
import Rhythia from "@/app/rhythia/mobile";
import RhythKit from "@/app/rhythkit/mobile";
import Challenge from "@/app/challenge/mobile";
import Categories from "@/app/categories/mobile";
import Admin from "@/app/admin/mobile";
import Approval from "@/app/approval/mobile";
import Coach from "@/app/coach/mobile";
import Announcements from "@/app/announcements/mobile";
import Completion from "@/app/completion/mobile";
import Onboarding from "@/app/onboarding/mobile";
import SetupTags from "@/app/setup-tags/mobile";
import Terms from "@/app/terms/mobile";
import Verify2FA from "@/app/verify-2fa/mobile";
import ClipReviewers from "@/app/clip-reviewers/mobile";
import Profile from "@/app/profile/[username]/mobile";

const routes: Record<string, any> = { daily: Daily, path: Path, maps: Maps, battles: Battles, online: Online, wiki: Wiki, leaderboards: Leaderboards, clips: Clips, rules: Rules, "community-settings": CommunitySettings, messages: Messages, notifications: Notifications, settings: Settings, search: Search, login: Login, register: Register, rhythia: Rhythia, rhythkit: RhythKit, challenge: Challenge, categories: Categories, admin: Admin, approval: Approval, coach: Coach, announcements: Announcements, completion: Completion, onboarding: Onboarding, "setup-tags": SetupTags, terms: Terms, "verify-2fa": Verify2FA, "clip-reviewers": ClipReviewers };

export default async function MobileCatchAll({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (path.length === 0) return <MobilePage><Home /></MobilePage>;
  if (path[0] === "profile" && path[1]) return <MobilePage><Profile params={Promise.resolve({ username: path[1] })} /></MobilePage>;
  const Page = routes[path[0]];
  if (!Page || path.length > 1) notFound();
  return <MobilePage><Page /></MobilePage>;
}
