import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateUserForm, RoleSelect } from "@/components/admin/UsersClient";
import type { Role } from "@/lib/types/db";

const ROLE_LABEL: Record<Role, string> = {
  admin: "관리자",
  teacher: "선생님",
  student: "학생",
};

export default async function AdminUsersPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, display_name, role, coin_balance, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">계정 관리</h1>

      <CreateUserForm />

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
    </div>
  );
}
