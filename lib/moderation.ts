import { prisma } from "@/lib/db";
import { notifyClipModeration } from "@/lib/notifications";

export async function moderateClip(
  actorId: string,
  clipId: string,
  status: "approved" | "rejected",
  rejectionReason?: string | null
) {
  if (status !== "approved" && status !== "rejected") {
    return { error: "Status must be approved or rejected.", status: 400 };
  }

  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    select: { id: true, title: true, status: true, uploaderId: true },
  });
  if (!clip) return { error: "Clip not found.", status: 404 };

  const reason =
    typeof rejectionReason === "string"
      ? rejectionReason.trim().slice(0, 500)
      : null;

  if (status === "rejected" && !reason) {
    return { error: "A rejection reason is required.", status: 400 };
  }

  const updated = await prisma.clip.update({
    where: { id: clipId },
    data: {
      status,
      rejectionReason: status === "rejected" ? reason : null,
    },
    select: { id: true, status: true, rejectionReason: true },
  });

  await prisma.moderationAction.create({
    data: {
      actorId,
      action: status === "approved" ? "clip_approved" : "clip_rejected",
      targetType: "clip",
      targetId: clip.id,
      metadata: {
        title: clip.title,
        previousStatus: clip.status,
        rejectionReason: reason,
      },
    },
  });

  await notifyClipModeration(
    { id: clip.id, title: clip.title, uploaderId: clip.uploaderId },
    status,
    reason
  );

  return { clip: updated };
}
