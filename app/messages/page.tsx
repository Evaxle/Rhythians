import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { MessagesApp } from "@/components/messages/messages-app";
import { GroupChatEnhancer } from "@/components/messages/group-chat-enhancer";
import { GroupChatManager } from "@/components/messages/group-chat-manager";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ user?: string; conversation?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { user: targetHandle, conversation } = await searchParams;
  return <div className="ui-page"><MessagesApp currentUserId={user.id} initialTargetHandle={targetHandle} initialConversationId={conversation} /><GroupChatEnhancer /><GroupChatManager conversationId={conversation} currentUserId={user.id} /></div>;
}
