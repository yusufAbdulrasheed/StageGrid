import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Pagination({
  page,
  pageCount,
  params,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    return `/events${sp.size ? `?${sp}` : ""}`;
  };

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  return (
    <nav aria-label="Pagination" className="mt-14 flex items-center justify-between gap-4 border-t border-line pt-6">
      <Link
        href={href(page - 1)}
        aria-disabled={page === 1}
        className={cn("btn btn-ghost btn-sm", page === 1 && "pointer-events-none opacity-40")}
      >
        ← Previous
      </Link>
      <ol className="flex items-center gap-1 font-mono text-[13px]">
        {pages.map((p, i) => (
          <li key={p} className="flex items-center">
            {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-faint">…</span>}
            <Link
              href={href(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "grid h-8 min-w-8 place-items-center rounded px-2 tabular-nums",
                p === page ? "bg-surface-2 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {p}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href={href(page + 1)}
        aria-disabled={page === pageCount}
        className={cn("btn btn-ghost btn-sm", page === pageCount && "pointer-events-none opacity-40")}
      >
        Next →
      </Link>
    </nav>
  );
}
