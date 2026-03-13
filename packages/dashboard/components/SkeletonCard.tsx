export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-gray-800/50 bg-gray-900/40 p-5 ${className}`}
    >
      <div className="animate-shimmer h-3 w-20 rounded bg-gray-800 mb-3" />
      <div className="animate-shimmer h-7 w-32 rounded bg-gray-800 mb-2" />
      <div className="animate-shimmer h-2.5 w-24 rounded bg-gray-800" />
    </div>
  );
}
