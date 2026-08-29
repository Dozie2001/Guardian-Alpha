export default function Loading() {
  return (
    <main className="floor-texture min-h-screen bg-background px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <div className="h-44 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.035]" />
          <div className="h-96 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.035]" />
        </div>
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.035]" />
          <div className="h-96 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.035]" />
        </div>
      </div>
    </main>
  );
}
