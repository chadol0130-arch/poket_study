export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-poke-red" />
        <p className="text-sm">불러오는 중…</p>
      </div>
    </div>
  );
}
