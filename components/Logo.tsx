import Link from "next/link";

/** 3×3 grid mark with a single lit cell. */
export function LogoMark({ size = 22 }: { size?: number }) {
  const cells = Array.from({ length: 9 });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {cells.map((_, i) => {
        const x = (i % 3) * 8;
        const y = Math.floor(i / 3) * 8;
        return (
          <rect
            key={i}
            x={x + 1}
            y={y + 1}
            width="6"
            height="6"
            rx="1.2"
            fill={i === 5 ? "var(--accent)" : "var(--ink)"}
            opacity={i === 5 ? 1 : 0.9 - (i % 4) * 0.15}
          />
        );
      })}
    </svg>
  );
}

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="StageGrid home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">
        Stage<span className="text-muted">Grid</span>
      </span>
    </Link>
  );
}
