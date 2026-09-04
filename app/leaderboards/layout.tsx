import { RbpLeaderboards } from "@/components/leaderboards/rbp-leaderboards";

export default async function LeaderboardsLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}<RbpLeaderboards /></div>;
}
