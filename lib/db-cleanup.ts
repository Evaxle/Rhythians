import { prisma } from "./db";
import { censorProfanity } from "./profanity";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

export type DbCleanupResults = {
  sessionsDeleted: number;
  readNotificationsDeleted: number;
  dismissedReportsDeleted: number;
  resolvedRequestsDeleted: number;
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
    commentsCensored: 0,
    coachCommentsCensored: 0,
    messagesCensored: 0,
  };

  results.sessionsDeleted = (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
  results.readNotificationsDeleted = (await prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: daysAgo(30) } } })).count;
  results.dismissedReportsDeleted = (await prisma.report.deleteMany({ where: { status: "dismissed", resolvedAt: { lt: daysAgo(90) } } })).count;
  results.resolvedRequestsDeleted = (await prisma.rhythiaProfileRequest.deleteMany({ where: { status: { in: ["approved", "denied"] }, resolvedAt: { lt: daysAgo(90) } } })).count;

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
