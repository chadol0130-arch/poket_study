import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth";
import type { Role } from "@/lib/types/db";

// 루트는 역할 홈으로 분기 (미들웨어가 대부분 처리하지만 안전망).
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(homeForRole((profile?.role as Role) ?? "student"));
}
