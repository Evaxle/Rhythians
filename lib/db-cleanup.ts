import { prisma } from "./db";
import { supabaseAdmin } from "./supabase";
import { censorProfanity } from "./profanity";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

export type DbCleanupResults = {
  sessionsDeleted: number;
  readNotificationsDeleted: number;
  dismissedReportsDeleted: number;
  resolvedRequestsDeleted: number;
  deletedClipFiles: number;
  rejectedClipFiles: number;
  orphanedClipFiles: number;
  orphanedThumbnailFiles: number;
  commentsCensored: number;
  coachCommentsCensored: number;
  messagesCensored: number;
};

async function censorComments(): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.comment.findMany({
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, text: true },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const filtered = censorProfanity(row.text);
      if (filtered.matched && filtered.filtered !== row.text) {
        await prisma.comment.update({ where: { id: row.id }, data: { text: filtered.filtered } });
        total++;
      }
    }
    cursor = rows[rows.length - 1].id;
  }
  return total;
}

async function censorCoachComments(): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.coachComment.findMany({
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, text: true },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const filtered = censorProfanity(row.text);
      if (filtered.matched && filtered.filtered !== row.text) {
        await prisma.coachComment.update({ where: { id: row.id }, data: { text: filtered.filtered } });
        total++;
      }
    }
    cursor = rows[rows.length - 1].id;
  }
  return total;
}

async function censorMessages(): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.message.findMany({
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, content: true },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const filtered = censorProfanity(row.content);
      if (filtered.matched && filtered.filtered !== row.content) {
        await prisma.message.update({ where: { id: row.id }, data: { content: filtered.filtered } });
        total++;
      }
    }
    cursor = rows[rows.length - 1].id;
  }
  return total;
}

async function removeStorageFiles(paths: string[]) {
  if (!supabaseAdmin || paths.length === 0) return 0;
  const bucket = process.env.STORAGE_BUCKET ?? "media";
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await supabaseAdmin.storage.from(bucket).remove(batch);
    if (!error) removed += batch.length;
  }
  return removed;
}

async function cleanupClipStorage() {
  if (!supabaseAdmin) {
    return { deletedClipFiles: 0, rejectedClipFiles: 0, orphanedClipFiles: 0, orphanedThumbnailFiles: 0 };
  }

  const cutoff = daysAgo(7);
  const [deletedClips, rejectedClips, allClips] = await Promise.all([
    prisma.clip.findMany({ where: { status: "deleted", updatedAt: { lt: cutoff } }, select: { storagePath: true, thumbnailPath: true } }),
    prisma.clip.findMany({ where: { status: "rejected", updatedAt: { lt: cutoff } }, select: { storagePath: true, thumbnailPath: true } }),
    prisma.clip.findMany({ select: { storagePath: true, thumbnailPath: true } }),
  ]);

  const referencedClipPaths = new Set(allClips.map((clip) => clip.storagePath));
  const referencedThumbnailPaths = new Set(allClips.flatMap((clip) => clip.thumbnailPath ? [clip.thumbnailPath] : []));
  const deletedPaths = deletedClips.flatMap((clip) => [clip.storagePath, ...(clip.thumbnailPath ? [clip.thumbnailPath] : [])]);
  const rejectedPaths = rejectedClips.flatMap((clip) => [clip.storagePath, ...(clip.thumbnailPath ? [clip.thumbnailPath] : [])]);

  const bucket = process.env.STORAGE_BUCKET ?? "media";
  const [clipObjects, thumbnailObjects] = await Promise.all([
    supabaseAdmin.storage.from(bucket).list("clips", { limit: 1000 }),
    supabaseAdmin.storage.from(bucket).list("thumbnails", { limit: 1000 }),
  ]);

  const staleClipObjectPaths = (clipObjects.data ?? [])
    .filter((object) => object.created_at && new Date(object.created_at) < cutoff)
    .map((object) => `clips/${object.name}`)
    .filter((path) => !referencedClipPaths.has(path));

  const staleThumbnailObjectPaths = (thumbnailObjects.data ?? [])
    .filter((object) => object.created_at && new Date(object.created_at) < cutoff)
    .map((object) => `thumbnails/${object.name}`)
    .filter((path) => !referencedThumbnailPaths.has(path));

  const [deletedClipFiles, rejectedClipFiles, orphanedClipFiles, orphanedThumbnailFiles] = await Promise.all([
    removeStorageFiles(deletedPaths),
    removeStorageFiles(rejectedPaths),
    removeStorageFiles(staleClipObjectPaths),
    removeStorageFiles(staleThumbnailObjectPaths),
  ]);

  return { deletedClipFiles, rejectedClipFiles, orphanedClipFiles, orphanedThumbnailFiles };
}

async function backfillProfanity() {
  return {
    commentsCensored: await censorComments(),
    coachCommentsCensored: await censorCoachComments(),
    messagesCensored: await censorMessages(),
  };
}

export async function runDbCleanup(options: { forceBackfill?: boolean } = {}) {
  const results: DbCleanupResults = {
    sessionsDeleted: 0,
    readNotificationsDeleted: 0,
    dismissedReportsDeleted: 0,
    resolvedRequestsDeleted: 0,
    deletedClipFiles: 0,
    rejectedClipFiles: 0,
    orphanedClipFiles: 0,
    orphanedThumbnailFiles: 0,
    commentsCensored: 0,
    coachCommentsCensored: 0,
    messagesCensored: 0,
  };

  results.sessionsDeleted = (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
  results.readNotificationsDeleted = (await prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: daysAgo(30) } } })).count;
  results.dismissedReportsDeleted = (await prisma.report.deleteMany({ where: { status: "dismissed", resolvedAt: { lt: daysAgo(90) } } })).count;
  results.resolvedRequestsDeleted = (await prisma.rhythiaProfileRequest.deleteMany({ where: { status: { in: ["approved", "denied"] }, resolvedAt: { lt: daysAgo(90) } } })).count;

  const storageCleanup = await cleanupClipStorage();
  Object.assign(results, storageCleanup);

  const backfillDone = await prisma.siteSetting.findUnique({ where: { key: "profanity_backfill_done" } });
  if (options.forceBackfill || !backfillDone) {
    const backfill = await backfillProfanity();
    results.commentsCensored = backfill.commentsCensored;
    results.coachCommentsCensored = backfill.coachCommentsCensored;
    results.messagesCensored = backfill.messagesCensored;
    if (!backfillDone) {
      await prisma.siteSetting.upsert({
        where: { key: "profanity_backfill_done" },
        update: { value: new Date().toISOString() },
        create: { key: "profanity_backfill_done", value: new Date().toISOString() },
      });
    }
  }

  return results;
}
