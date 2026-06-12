function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#E8E6E1] ${className}`} />;
}

export default function HotspotsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <SkeletonBlock className="h-10 w-full" />
      <SkeletonBlock className="mt-5 h-20 w-full" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}
