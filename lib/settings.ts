import { prisma } from "@/lib/db";

const RETENTION_KEY = "message_retention_days";
const DEFAULT_RETENTION_DAYS = 30;
const LAST_PRUNE_KEY = "last_message_prune";

export async function getSiteSettings() {
  const settings = await prisma.siteSetting.findMany();
  return Object.fromEntries(settings.map((item) => [item.key, item.value]));
}

export async function getSiteSetting(key: string) {
  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function getMessageRetentionDays() {
  const value = await getSiteSetting(RETENTION_KEY);
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

export async function setMessageRetentionDays(days: number) {
  return prisma.siteSetting.upsert({
    where: { key: RETENTION_KEY },
    update: { value: String(days) },
    create: { key: RETENTION_KEY, value: String(days), description: "How many days messages are kept before automatic deletion." },
  });
}

const MIN_PRUNES_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function pruneExpiredMessages() {
  const lastPrune = await getSiteSetting(LAST_PRUNE_KEY);
  if (lastPrune) {
    const elapsed = Date.now() - new Date(lastPrune).getTime();
    if (elapsed < MIN_PRUNES_INTERVAL_MS) return;
  }

  const retentionDays = await getMessageRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  await prisma.message.deleteMany({
    where: {
      isDeleted: false,
      createdAt: { lt: cutoff },
    },
  });

  await prisma.siteSetting.upsert({
    where: { key: LAST_PRUNE_KEY },
    update: { value: new Date().toISOString() },
    create: { key: LAST_PRUNE_KEY, value: new Date().toISOString(), description: "Timestamp of the last message retention prune." },
  });
}
