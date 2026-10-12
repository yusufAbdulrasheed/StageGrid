export default function BarChart({ data }: { data: { day: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const ticks = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <figure>
      <figcaption className="sr-only">
        {total} registrations over the last {data.length} days, peaking at {max} per day.
      </figcaption>
      <div className="relative flex h-44 items-end gap-[3px] border-b border-line pt-2" aria-hidden>
        {[0.5, 1].map((f) => (
          <span key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
        ))}
        {data.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className={`w-full rounded-t-[2px] transition-colors ${i === data.length - 1 ? "bg-accent" : "bg-line-strong group-hover:bg-muted"}`}
              style={{ height: d.n ? `${Math.max(4, (d.n / max) * 100)}%` : "2px", opacity: d.n ? 1 : 0.5 }}
            />
            <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded border border-line-strong bg-bg px-2 py-1 text-[11px] group-hover:block">
              {fmt(d.day)} · {d.n}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-faint" aria-hidden>
        {ticks.map((i) => (
          <span key={i}>{fmt(data[i].day)}</span>
        ))}
      </div>
    </figure>
  );
}
