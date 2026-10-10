import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import { InviteForm } from "@/components/app/TeamForms";
import { requireOrg } from "@/lib/auth";
import { limitsFor, listInvitations, listMembers, memberSeatsUsed } from "@/lib/orgs";
import { changeRoleAction, removeMemberAction, revokeInviteAction } from "@/app/actions/org";
import { can, atLeast } from "@/lib/plans";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const { user, org, role } = await requireOrg(slug, "team");
  const [members, invites, seats] = await Promise.all([listMembers(org.id), listInvitations(org.id), memberSeatsUsed(org.id)]);
  const max = limitsFor(org).members;
  const isOwner = can(role, "billing");

  return (
    <>
      <PageHeader title="Team" description={`${seats} of ${max} seats used on your plan.`} />

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="invite">
        <h2 id="invite" className="mb-4 text-[15px] font-medium">Invite someone</h2>
        <InviteForm slug={slug} />
        <p className="mt-4 text-xs text-faint">
          Members manage events and check people in. Admins can also manage the team and settings. Only the owner controls billing.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="members">
        <h2 id="members" className="mb-3 text-[15px] font-medium">Members</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {members.map((m) => {
            const isSelf = m.userId === user.id;
            const removable = m.role !== "owner" && (isSelf || atLeast(role, m.role === "admin" ? "owner" : "admin"));
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium">{m.name} {isSelf && <span className="text-faint">(you)</span>}</p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                {isOwner && m.role !== "owner" ? (
                  <form action={changeRoleAction.bind(null, slug, m.userId)} className="flex items-center gap-2">
                    <select name="role" defaultValue={m.role} className="input h-8 w-28 text-sm" aria-label={`Role for ${m.name}`}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="btn btn-ghost btn-sm" type="submit">Save</button>
                  </form>
                ) : (
                  <span className="chip capitalize">{m.role}</span>
                )}
                {removable && (
                  <form action={removeMemberAction.bind(null, slug, m.userId)}>
                    <button type="submit" className="btn btn-danger btn-sm">{isSelf ? "Leave" : "Remove"}</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {invites.length > 0 && (
        <section className="mt-8" aria-labelledby="pending">
          <h2 id="pending" className="mb-3 text-[15px] font-medium">Pending invitations</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.email}</p>
                  <p className="text-xs text-faint">Expires {i.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <span className="chip capitalize">{i.role}</span>
                <form action={revokeInviteAction.bind(null, slug, i.id)}>
                  <button type="submit" className="btn btn-ghost btn-sm">Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
