"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-5xl">😵</p>
        <h1 className="mt-3 text-lg font-bold">앗, 문제가 생겼어요</h1>
        <p className="mt-1 text-sm text-slate-500">잠시 후 다시 시도해 주세요.</p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-poke-red px-5 py-2.5 font-bold text-white hover:bg-poke-red/90"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
