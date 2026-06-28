import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmissionForm } from "@/components/homework/SubmissionForm";

export default async function SubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("student", "admin");
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("homework_assignments")
    .select("id, title, description, xp_reward, coin_reward, classes(name)")
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: existing } = await supabase
    .from("submissions")
    .select("note, status")
    .eq("assignment_id", id)
    .eq("student_id", profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/assignments" className="text-sm text-slate-500">
        ← 숙제 목록
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{assignment.title}</h1>
        <p className="text-sm text-slate-500">
          {(assignment as any).classes?.name} · ⭐ {assignment.xp_reward} XP · 🪙{" "}
          {assignment.coin_reward}
        </p>
        {assignment.description && (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {assignment.description}
          </p>
        )}
      </div>

      {existing?.status === "approved" ? (
        <p className="rounded-xl bg-green-50 p-4 text-center text-green-700">
          이미 통과된 숙제예요! 🎉
        </p>
      ) : (
        <SubmissionForm
          assignmentId={assignment.id}
          studentId={profile.id}
          existingNote={existing?.note ?? ""}
        />
      )}
    </div>
  );
}
