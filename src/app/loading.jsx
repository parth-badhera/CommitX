export default function Loading() {
  return (
    <div className="shell py-16 space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-28 rounded-full bg-raised/70 animate-pulse" />
      <div className="h-12 w-2/3 max-w-xl rounded-2xl bg-raised/70 animate-pulse" />
      <div className="grid md:grid-cols-3 gap-4 pt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-raised/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
