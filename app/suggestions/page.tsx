import { getSessionUser } from "@/lib/auth";
import { SuggestionsForum } from "@/components/suggestions/suggestions-forum";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const user = await getSessionUser().catch(() => null);
  return <SuggestionsForum signedIn={Boolean(user)} />;
}
