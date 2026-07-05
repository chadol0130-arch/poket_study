"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 카카오톡 등 앱 내장 브라우저(WebView)에서는 구글이 OAuth 를 차단(403 disallowed_useragent).
  const [inApp, setInApp] = useState(false);
  const [isKakao, setIsKakao] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setInApp(/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps/i.test(ua));
    setIsKakao(/KAKAOTALK/i.test(ua));
    setIsIOS(/iPhone|iPad|iPod/i.test(ua));
  }, []);

  function openExternal() {
    const url = window.location.href;
    if (isKakao) {
      // 카카오톡 공식 외부 브라우저 열기 스킴 (iOS/Android 공통)
      window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
      return;
    }
    if (!isIOS) {
      // Android 인앱 브라우저: intent 스킴으로 기본 브라우저 열기
      window.location.href =
        "intent://" + window.location.host + window.location.pathname + "#Intent;scheme=https;end";
    }
    // iOS 의 비카카오 인앱은 프로그램적 탈출 불가 → 아래 안내 문구로 유도.
  }

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

  async function googleLogin() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError("구글 로그인 실패: " + error.message);
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

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          또는
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        {inApp ? (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">
              카카오톡·인스타 앱 안에서는 구글 로그인이 막혀 있어요 🙏
            </p>
            <p className="text-xs text-amber-700">
              아래 버튼으로 브라우저에서 열면 구글 로그인이 됩니다. (이메일 로그인은 여기서도 가능해요)
            </p>
            <button
              onClick={openExternal}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
            >
              🌐 크롬/사파리로 열기
            </button>
            {isIOS && !isKakao && (
              <p className="text-xs text-amber-600">
                버튼이 안 되면: 화면 하단 <b>공유(⋯) → 다른 브라우저로 열기</b>를 눌러주세요.
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={googleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            구글로 로그인
          </button>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          이메일 계정은 선생님/관리자가 발급합니다.
        </p>
      </div>
    </main>
  );
}
