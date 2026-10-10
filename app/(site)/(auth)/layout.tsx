import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="hairline-grid absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-14">
          <LogoMark size={34} />
          <blockquote>
            <p className="display text-5xl text-balance">
              Good nights start with a <em className="text-accent">good ticket</em>.
            </p>
            <p className="mt-6 max-w-sm text-sm text-muted">
              Concerts, parties, festivals, workshops. Book in a few taps and keep every ticket in one place.
            </p>
          </blockquote>
          <Link href="/events" className="text-sm text-muted hover:text-ink">
            ← Browse events first
          </Link>
        </div>
      </aside>
      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
