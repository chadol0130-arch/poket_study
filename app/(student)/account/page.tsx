import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "@/components/account/AccountForm";

const ROLE_KO: Record<string, string> = {
  admin: "관리자",
  teacher: "선생님",
  student: "학생",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: React.ReactNode; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default async function AccountPage() {
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 내가 속한 반 이름들 (활성 등록)
  const { data: enr } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", profile.id)
    .eq("status", "active");
  const classIds = (enr ?? []).map((e: any) => e.class_id);
  let classNames: string[] = [];
  if (classIds.length > 0) {
    const { data: cls } = await supabase
      .from("classes")
      .select("name")
      .in("id", classIds);
    classNames = (cls ?? []).map((c: any) => c.name);
  }

  // 보유 포켓몬 수
  const { count: petCount } = await supabase
    .from("student_pokemon")
    .select("id", { count: "exact", head: true })
    .eq("student_id", profile.id);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">내 정보</h1>
        <p className="text-slate-500">내 계정 정보를 확인하고 이름을 바꿀 수 있어요.</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox icon="🪙" label="코인" value={profile.coin_balance ?? 0} />
        <StatBox icon="🔥" label="연속 출석" value={`${profile.current_streak ?? 0}일`} />
        <StatBox icon="🐾" label="포켓몬" value={`${petCount ?? 0}마리`} />
      </div>

      {/* 도전과제 */}
      <Link
        href="/achievements"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 hover:border-poke-blue"
      >
        <span className="font-semibold">🏅 도전과제</span>
        <span className="text-sm text-poke-blue">보기 →</span>
      </Link>

      {/* 기본 정보 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-bold">계정</h2>
        <InfoRow label="이메일" value={user?.email ?? "—"} />
        <InfoRow label="이름" value={profile.display_name || profile.full_name || "—"} />
        <InfoRow label="역할" value={ROLE_KO[profile.role] ?? profile.role} />
        <InfoRow
          label="소속 반"
          value={classNames.length > 0 ? classNames.join(", ") : "아직 없음"}
        />
        <InfoRow label="최고 연속 출석" value={`${profile.longest_streak ?? 0}일`} />
      </div>

      {/* 이름 변경 + 로그아웃 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">설정</h2>
        <AccountForm initialName={profile.display_name || ""} />
      </div>

      <p className="text-center text-xs text-slate-400">
        이메일·비밀번호 변경이나 계정 삭제가 필요하면 선생님(관리자)에게 문의하세요.
      </p>
    </div>
  );
}
