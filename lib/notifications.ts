import { prisma } from "@/lib/db";

export async function notifyClipModeration(
  clip: { id: string; title: string; uploaderId: string },
  status: "approved" | "rejected",
  rejectionReason: string | null
) {
  if (status === "approved") {
    await prisma.notification.create({
      data: {
        userId: clip.uploaderId,
        type: "clip_approved",
        title: "Your clip was approved",
        message: `"${clip.title}" has been approved and is now live on the site.`,
        url: `/clips/${clip.id}`,
      },
    });
    return;
  }

  const reason = rejectionReason?.trim()
    ? `Reason: ${rejectionReason.trim()}`
    : "No reason was provided.";

  await prisma.notification.create({
    data: {
      userId: clip.uploaderId,
      type: "clip_rejected",
      title: "Your clip was rejected",
      message: `"${clip.title}" was rejected.\n\n${reason}\n\nReview the feedback above, adjust your clip, and you can submit it again for approval.`,
      url: `/clips/submit`,
    },
  });
}
