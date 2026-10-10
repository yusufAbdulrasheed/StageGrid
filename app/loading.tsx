export default function Loading() {
  return (
    <div className="wrap pt-14" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-5 h-14 w-full max-w-md" />
      <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/3]" />
            <div className="skeleton mt-4 h-3 w-1/3" />
            <div className="skeleton mt-3 h-5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
