import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getInvitation } from "@/lib/orgs";
import { acceptInviteAction } from "@/app/actions/org";

export const metadata: Metadata = { title: "Join workspace", robots: { index: false } };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mismatch?: string }>;
}) {
  const [{ token }, { mismatch }] = await Promise.all([params, searchParams]);
  const [inv, user] = await Promise.all([getInvitation(token), getCurrentUser()]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5 py-16">
      {!inv ? (
        <>
          <h1 className="display text-5xl">Invitation expired.</h1>
          <p className="mt-3 text-muted">Ask the workspace owner to send you a new invite.</p>
          <Link href="/" className="btn btn-ghost mt-8 w-fit">Back home</Link>
        </>
      ) : (
        <>
          <p className="eyebrow">Invitation</p>
          <h1 className="display mt-3 text-5xl text-balance">Join {inv.orgName}.</h1>
          <p className="mt-3 text-muted">
            You&apos;ve been invited as {inv.role === "admin" ? "an admin" : "a member"}. This invite is for{" "}
            <span className="text-ink">{inv.email}</span>.
          </p>
          {mismatch && user && (
            <p role="alert" className="mt-5 rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              You&apos;re signed in as {user.email}. Sign in with {inv.email} to accept.
            </p>
          )}
          <form action={acceptInviteAction.bind(null, token)} className="mt-8">
            <button className="btn btn-primary btn-lg w-full" type="submit">
              {user ? "Accept invitation" : "Sign in to accept"}
            </button>
          </form>
          {!user && (
            <p className="mt-4 text-sm text-muted">
              New here?{" "}
              <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`} className="underline underline-offset-4 hover:text-ink">
                Create an account
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
