import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types/db";

/** 현재 로그인 사용자의 프로필을 반환(없으면 /login 리다이렉트). */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  return profile as Profile;
}

/** 특정 역할만 허용. 권한 없으면 본인 홈으로 리다이렉트. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect(homeForRole(profile.role));
  }
  return profile;
}

export function homeForRole(role: Role): string {
  if (role === "admin") return "/admin/users";
  if (role === "teacher") return "/queue";
  return "/dashboard";
}
