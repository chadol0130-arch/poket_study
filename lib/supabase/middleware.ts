import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** 역할별 기본 랜딩 경로 */
function homeForRole(role: string | undefined): string {
  if (role === "admin") return "/admin/users";
  if (role === "teacher") return "/queue";
  return "/dashboard";
}

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * 모든 요청에서 세션 쿠키를 갱신하고, 거친(UX 레벨) 역할 게이팅을 수행한다.
 * 실제 보안 경계는 DB 의 RLS 다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  // 미인증 사용자는 로그인으로
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 역할 조회는 역할 홈 리다이렉트가 실제로 필요한 경로(/, /login)에서만.
  // 역할 영역 보호(/admin·/queue·/classes)는 각 레이아웃의 requireRole + RLS 가 수행하므로
  // 여기서 매 요청마다 profiles 를 조회하지 않는다 (요청당 DB 왕복 2→1회).
  if (user && (path === "/login" || path === "/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(profile?.role as string | undefined);
    return NextResponse.redirect(url);
  }

  return response;
}
