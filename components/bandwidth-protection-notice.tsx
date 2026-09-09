import { bandwidthProtectionEnabled, bandwidthProtectionMessage } from "@/lib/bandwidth-protection";

export function BandwidthProtectionNotice() {
  if (!bandwidthProtectionEnabled) return null;
  return <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-100 sm:text-sm">{bandwidthProtectionMessage}</div>;
}
