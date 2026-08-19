import { redirect } from "next/navigation";

export default function ChallengePage() {
  redirect("/categories?tab=challenge");
}
