import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateUserForm, RoleSelect } from "@/components/admin/UsersClient";
import type { Role } from "@/lib/types/db";

const ROLE_LABEL: Record<Role, string> = {
  admin: "관리자",
  teacher: "선생님",
  student: "학생",
};
const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireRole("admin");
  const supabase = await createClient();

  const params = await searchParams;
  const q = (params.q ?? "").trim().replace(/[%_]/g, "");
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("profiles")
    .select("id, display_name, role, coin_balance, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (q) {
    query = query.or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  const { data: users, count } = await query;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) =>
    `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">계정 관리</h1>

      <CreateUserForm />

      {/* 검색 (서버 검색 — 전체 계정을 로드하지 않음) */}
      <form action="/admin/users" method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 검색"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
        <button className="rounded-lg bg-poke-blue px-4 py-2 text-sm font-semibold text-white">
          검색
        </button>
        {q && (
          <Link
            href="/admin/users"
            className="self-center whitespace-nowrap text-sm text-slate-500"
          >
            초기화
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">역할</th>
              <th className="px-4 py-2">코인</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  {q ? "검색 결과가 없어요." : "계정이 없어요."}
                </td>
              </tr>
            )}
            {(users ?? []).map((u: any) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{u.display_name}</td>
                <td className="px-4 py-2">
                  <RoleSelect userId={u.id} role={u.role as Role} />
                  <span className="ml-2 text-xs text-slate-400">
                    {ROLE_LABEL[u.role as Role]}
                  </span>
                </td>
                <td className="px-4 py-2">🪙 {u.coin_balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          전체 {total}명 · {page}/{totalPages} 페이지
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              ← 이전
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              다음 →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
