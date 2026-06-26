import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 서버 컴포넌트 / 서버 액션 / 라우트 핸들러에서 쓰는 Supabase 클라이언트.
 * 호출자(로그인한 사용자)의 세션 쿠키로 동작하므로 RLS 정책이 그대로 적용된다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출되면 set 이 불가하다 — 미들웨어가 세션을 갱신하므로 무시.
          }
        },
      },
    },
  );
}
