export default function ProductCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="aspect-square w-full bg-stone-200" />
      <div className="space-y-2 p-3 sm:p-4">
        <div className="h-4 w-3/4 rounded bg-stone-200" />
        <div className="h-4 w-1/3 rounded bg-stone-200" />
      </div>
    </div>
  );
}