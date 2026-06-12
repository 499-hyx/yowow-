function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#E8E6E1] ${className}`} />;
}

export default function AccountLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <SkeletonBlock className="h-10 w-full" />
      <SkeletonBlock className="mt-4 h-40 w-full" />
      <div className="mt-5 space-y-3">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-56 w-full" />
        <SkeletonBlock className="h-56 w-full" />
      </div>
    </main>
  );
}
