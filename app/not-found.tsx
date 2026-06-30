import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-5xl">🔍</p>
        <h1 className="mt-3 text-lg font-bold">페이지를 찾을 수 없어요</h1>
        <p className="mt-1 text-sm text-slate-500">주소가 바뀌었거나 사라진 페이지예요.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-poke-blue px-5 py-2.5 font-bold text-white hover:bg-poke-blue/90"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
