import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">Error 404</p>
      <h1 className="display mt-4 text-[clamp(3.5rem,10vw,7rem)]">
        Nothing <em className="text-accent">here</em>.
      </h1>
      <p className="mt-5 max-w-md text-muted">
        The page you&apos;re after has moved, ended, or never existed. Let&apos;s get you back to the grid.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/events" className="btn btn-primary btn-lg">Browse events</Link>
        <Link href="/" className="btn btn-ghost btn-lg">Home</Link>
      </div>
    </div>
  );
}
