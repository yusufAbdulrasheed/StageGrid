import Link from "next/link";
import Logo from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { listUserOrgs } from "@/lib/orgs";

const publicLinks = [
  { href: "/events", label: "Events" },
  { href: "/pricing", label: "For organizers" },
];

export default async function SiteHeader() {
  const user = await getCurrentUser();
  const isOrganizer = user ? (await listUserOrgs(user.id)).length > 0 : false;
  const links = user && !isOrganizer ? [{ href: "/events", label: "Events" }, { href: "/history", label: "My bookings" }] : publicLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <Logo href={user && !isOrganizer ? "/events" : "/"} />
          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm text-muted md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {isOrganizer && (
                <>
                  <Link href="/history" className="btn border-transparent text-muted hover:text-ink">
                    My bookings
                  </Link>
                  <Link href="/app" className="btn btn-primary">
                    Dashboard
                  </Link>
                </>
              )}
              <span className="px-2 text-sm text-muted">{user.name.split(" ")[0]}</span>
              <form action={logoutAction}>
                <button className="btn btn-ghost text-muted" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn border-transparent text-muted hover:text-ink">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Create account
              </Link>
            </>
          )}
        </div>

        <details className="group relative md:hidden">
          <summary className="btn btn-ghost list-none px-3 [&::-webkit-details-marker]:hidden" aria-label="Menu">
            <span className="relative block h-3 w-4">
              <span className="absolute inset-x-0 top-0 h-px bg-ink transition-transform group-open:translate-y-[5px] group-open:rotate-45" />
              <span className="absolute inset-x-0 bottom-0 h-px bg-ink transition-transform group-open:-translate-y-[6px] group-open:-rotate-45" />
            </span>
          </summary>
          <div className="absolute right-0 top-12 w-60 rounded-[var(--radius-card)] border border-line-strong bg-surface p-2 shadow-2xl shadow-black/50">
            {[
              ...links,
              ...(user
                ? [...(isOrganizer ? [{ href: "/app", label: "Dashboard" }, { href: "/history", label: "My bookings" }] : [])]
                : [{ href: "/login", label: "Sign in" }, { href: "/signup", label: "Create account" }]),
            ].map((l) => (
              <Link key={l.href} href={l.href} className="block rounded px-3 py-2.5 text-sm hover:bg-surface-2">
                {l.label}
              </Link>
            ))}
            {user && (
              <form action={logoutAction}>
                <button className="block w-full rounded px-3 py-2.5 text-left text-sm text-muted hover:bg-surface-2" type="submit">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
