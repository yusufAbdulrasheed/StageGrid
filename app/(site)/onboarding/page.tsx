import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateOrgForm } from "@/components/OrgForm";
import { requireUser } from "@/lib/auth";
import { listUserOrgs } from "@/lib/orgs";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = { title: "Create your workspace", robots: { index: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; new?: string }> }) {
  const user = await requireUser("/onboarding");
  const { plan, new: isNew } = await searchParams;
  const orgs = await listUserOrgs(user.id);
  if (orgs.length > 0 && !isNew) redirect(`/app/${orgs[0].org.slug}`);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-16">
      <LogoMark size={32} />
      <h1 className="display mt-8 text-5xl">Name your workspace.</h1>
      <p className="mb-8 mt-3 text-muted">
        Welcome, {user.name.split(" ")[0]}. A workspace holds your events, attendees and team.
      </p>
      <CreateOrgForm plan={plan === "pro" || plan === "business" ? plan : undefined} />
    </div>
  );
}
