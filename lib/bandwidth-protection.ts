const disabledValues = new Set(["0", "false", "off", "disabled"]);

export const bandwidthProtectionEnabled = !disabledValues.has((process.env.SUPABASE_BANDWIDTH_PROTECTION ?? "on").trim().toLowerCase());
export const bandwidthProtectionMessage = "Some Supabase-hosted media and downloads are temporarily limited while Rhythians reduces bandwidth usage. Core site features remain available.";
