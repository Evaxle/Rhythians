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
import RankedMap from "@/app/maps/[id]/page";
import AdminDashboard from "@/app/admin/page";
import AdminAnnouncements from "@/app/admin/announcements/page";
import AdminAnnouncementNew from "@/app/admin/announcements/new/page";
import AdminClips from "@/app/admin/clips/page";
import AdminCompletionClips from "@/app/admin/completion-clips/page";
import AdminManageClips from "@/app/admin/clips/manage/page";
import AdminFeaturedClips from "@/app/admin/featured-clips/page";
import AdminMaps from "@/app/admin/maps/page";
import AdminCategories from "@/app/admin/categories/page";
import AdminChallenge from "@/app/admin/challenge/page";
import AdminUsers from "@/app/admin/users/page";
import AdminRhythiaRequests from "@/app/admin/rhythia-requests/page";
import AdminRhythianPath from "@/app/admin/rhythian-path/page";
import AdminAlerts from "@/app/admin/alerts/page";
import AdminReports from "@/app/admin/reports/page";
import AdminDiscord from "@/app/admin/discord/page";
import AdminSettings from "@/app/admin/settings/page";

const routes: Record<string, any> = {
  daily: Daily,
  path: Path,
  maps: Maps,
  battles: Battles,
  online: Online,
  wiki: Wiki,
  leaderboards: Leaderboards,
  clips: Clips,
  rules: Rules,
  "community-settings": CommunitySettings,
  messages: Messages,
  notifications: Notifications,
  settings: Settings,
  search: Search,
  login: Login,
  register: Register,
  challenge: Challenge,
  categories: Categories,
  admin: Admin,
  "admin-dashboard": AdminDashboard,
  "admin-announcements": AdminAnnouncements,
  "admin-clips": AdminClips,
  "admin-completion-clips": AdminCompletionClips,
  "admin-manage-clips": AdminManageClips,
  "admin-featured-clips": AdminFeaturedClips,
  "admin-maps": AdminMaps,
  "admin-categories": AdminCategories,
  "admin-challenge": AdminChallenge,
  "admin-users": AdminUsers,
  "admin-rhythia-requests": AdminRhythiaRequests,
  "admin-rhythian-path": AdminRhythianPath,
  "admin-alerts": AdminAlerts,
  "admin-reports": AdminReports,
  "admin-discord": AdminDiscord,
  "admin-settings": AdminSettings,
  approval: Approval,
  coach: Coach,
  announcements: Announcements,
  completion: Completion,
  onboarding: Onboarding,
  "setup-tags": SetupTags,
  terms: Terms,
  "verify-2fa": Verify2FA,
  "clip-reviewers": ClipReviewers,
};

export default async function MobileCatchAll({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (path.length === 0) return <MobilePage><Home /></MobilePage>;
  if (path[0] === "profile" && path[1]) return <MobilePage><Profile params={Promise.resolve({ username: path[1] })} /></MobilePage>;
  if (path[0] === "maps" && path[1]) return <MobilePage><RankedMap params={Promise.resolve({ id: path[1] })} /></MobilePage>;
  if (path[0] === "admin") {
    if (path.length === 1) return <MobilePage><AdminDashboard /></MobilePage>;
    if (path.length === 2 && path[1] === "announcements") return <MobilePage><AdminAnnouncements /></MobilePage>;
    if (path.length === 3 && path[1] === "announcements" && path[2] === "new") return <MobilePage><AdminAnnouncementNew /></MobilePage>;
    const adminPages: Record<string, any> = {
      clips: AdminClips,
      "completion-clips": AdminCompletionClips,
      maps: AdminMaps,
      categories: AdminCategories,
      challenge: AdminChallenge,
      users: AdminUsers,
      "rhythia-requests": AdminRhythiaRequests,
      "rhythian-path": AdminRhythianPath,
      alerts: AdminAlerts,
      reports: AdminReports,
      discord: AdminDiscord,
      settings: AdminSettings,
      "featured-clips": AdminFeaturedClips,
    };
    if (path.length === 2 && adminPages[path[1]]) { const AdminPage = adminPages[path[1]]; return <MobilePage><AdminPage /></MobilePage>; }
    if (path.length === 3 && path[1] === "clips" && path[2] === "manage") return <MobilePage><AdminManageClips /></MobilePage>;
    notFound();
  }
  const Page = routes[path[0]];
  if (!Page || path.length > 1) notFound();
  return <MobilePage><Page /></MobilePage>;
}
