import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppIndex() {
  const user = await requireUser("/app");
  redirect(await homeFor(user));
}
