import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AssignmentForm } from "@/components/homework/AssignmentForm";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("teacher", "admin");
  const supabase = await createClient();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!klass) notFound();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, status, profiles(display_name)")
    .eq("class_id", id)
    .eq("status", "active");

  const { data: assignments } = await supabase
    .from("homework_assignments")
    .select("id, title, xp_reward, coin_reward, created_at")
    .eq("class_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/classes" className="text-sm text-slate-500">
          ← 내 반
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{klass.name}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">학생 ({enrollments?.length ?? 0}명)</h2>
          <ul className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
            {(enrollments ?? []).length === 0 && (
              <li className="text-sm text-slate-400">등록된 학생이 없어요.</li>
            )}
            {(enrollments ?? []).map((e: any) => (
              <li key={e.student_id} className="text-sm">
                {e.profiles?.display_name ?? "학생"}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <AssignmentForm classId={id} />
          <div>
            <h2 className="mb-2 font-semibold">숙제 목록</h2>
            <ul className="space-y-2">
              {(assignments ?? []).length === 0 && (
                <li className="text-sm text-slate-400">아직 숙제가 없어요.</li>
              )}
              {(assignments ?? []).map((a: any) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span>{a.title}</span>
                  <span className="text-xs text-slate-500">
                    ⭐ {a.xp_reward} · 🪙 {a.coin_reward}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
