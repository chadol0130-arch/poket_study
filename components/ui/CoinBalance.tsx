/** 코인 잔액 배지. */
export function CoinBalance({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-poke-yellow/20 px-3 py-1 text-sm font-bold text-amber-700">
      <span aria-hidden>🪙</span>
      {amount.toLocaleString()}
    </span>
  );
}
