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

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role as string | undefined;

    // 로그인 상태에서 /login 또는 루트면 역할 홈으로
    if (path === "/login" || path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(role);
      return NextResponse.redirect(url);
    }

    // 역할 영역 보호: 학생이 교사/관리자 경로 접근 시 본인 홈으로.
    // (/assignments 는 학생 영역이라 제외 — 교사는 /classes 하위에서 과제 관리)
    const teacherOnly = ["/queue", "/classes"];
    const adminOnly = ["/admin"];
    const isTeacherPath = teacherOnly.some((p) => path === p || path.startsWith(p + "/"));
    const isAdminPath = adminOnly.some((p) => path === p || path.startsWith(p + "/"));

    if (isAdminPath && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(role);
      return NextResponse.redirect(url);
    }
    if (isTeacherPath && !(role === "teacher" || role === "admin")) {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(role);
      return NextResponse.redirect(url);
    }
  }

  return response;
}
