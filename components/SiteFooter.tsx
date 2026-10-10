import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { CATEGORIES } from "@/lib/constants";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <LogoMark size={20} />
            <span className="font-semibold tracking-tight">StageGrid</span>
          </div>
          <p className="mt-4 text-sm text-muted">Find events worth leaving the house for, or sell out your own.</p>
        </div>
        <div>
          <p className="eyebrow mb-4">Organizers</p>
          <ul className="space-y-2.5 text-sm text-muted">
            <li><Link className="hover:text-ink" href="/pricing">Pricing</Link></li>
            <li><Link className="hover:text-ink" href="/signup?type=organizer">Host an event</Link></li>
            <li><Link className="hover:text-ink" href="/login">Sign in</Link></li>
            <li><Link className="hover:text-ink" href="/api/health" prefetch={false}>Status</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-4">Explore</p>
          <ul className="space-y-2.5 text-sm text-muted">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link className="hover:text-ink" href={`/events?category=${encodeURIComponent(c)}`}>{c}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-4">More</p>
          <ul className="space-y-2.5 text-sm text-muted">
            <li><Link className="hover:text-ink" href="/api/events" prefetch={false}>Public events feed</Link></li>
            <li><Link className="hover:text-ink" href="/pricing#faq">FAQ</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-faint">
          <span>© {new Date().getFullYear()} StageGrid</span>
          <span>Developed by Abdulrasheed Yusuf</span>
        </div>
      </div>
    </footer>
  );
}
