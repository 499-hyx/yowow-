function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#E8E6E1] ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <SkeletonBlock className="h-10 w-full" />
      <div className="mt-6 grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-24" />
        ))}
      </div>
      <div className="mt-7 space-y-3">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-36 w-full" />
        <SkeletonBlock className="h-36 w-full" />
      </div>
    </main>
  );
}
