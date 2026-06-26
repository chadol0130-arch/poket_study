"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("로그인 실패: 이메일/비밀번호를 확인하세요.");
      setLoading(false);
      return;
    }
    // 미들웨어가 역할에 맞는 홈으로 보낸다.
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-poke-blue/10 to-poke-yellow/10 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-4xl">⚡️</div>
          <h1 className="mt-2 text-xl font-bold">포켓몬 숙제 트래커</h1>
          <p className="mt-1 text-sm text-slate-500">
            숙제하고 포켓몬을 키우자!
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-poke-blue focus:outline-none"
              placeholder="student@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-poke-blue focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-poke-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-poke-blue py-2.5 font-semibold text-white transition hover:bg-poke-blue/90 disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          계정은 선생님/관리자가 발급합니다.
        </p>
      </div>
    </main>
  );
}
