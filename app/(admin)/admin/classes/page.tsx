import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateClassForm, ClassRow } from "@/components/admin/ClassesClient";

export default async function AdminClassesPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: classes }, { data: teacherRows }, { data: cts }, { data: enrolls }] =
    await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      // 선생님은 소수 → 배정 드롭다운용으로 전체 로드. 학생은 검색 픽커로 대체(전체 로드 안 함).
      supabase.from("profiles").select("id, display_name").eq("role", "teacher"),
      supabase.from("class_teachers").select("class_id, teacher_id"),
      supabase
        .from("enrollments")
        .select("class_id, student_id")
        .eq("status", "active"),
    ]);

  const teachers = (teacherRows ?? []).map((p: any) => ({ id: p.id, name: p.display_name }));

  // 반에 실제로 배정/등록된 사람들의 이름만 조회 (전체 profiles 로드 금지)
  const refIds = Array.from(
    new Set([
      ...(cts ?? []).map((x: any) => x.teacher_id),
      ...(enrolls ?? []).map((x: any) => x.student_id),
    ]),
  );
  const nameById = new Map<string, string>();
  if (refIds.length > 0) {
    const { data: refPeople } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", refIds);
    (refPeople ?? []).forEach((p: any) => nameById.set(p.id, p.display_name));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">반 관리</h1>
      <CreateClassForm />

      <div className="space-y-4">
        {(classes ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
            아직 반이 없어요. 위에서 반을 만들어 보세요.
          </p>
        )}
        {(classes ?? []).map((c: any) => {
          const assignedTeachers = (cts ?? [])
            .filter((x: any) => x.class_id === c.id)
            .map((x: any) => ({ id: x.teacher_id, name: nameById.get(x.teacher_id) ?? "선생님" }));
          const enrolledStudents = (enrolls ?? [])
            .filter((x: any) => x.class_id === c.id)
            .map((x: any) => ({ id: x.student_id, name: nameById.get(x.student_id) ?? "학생" }));
          return (
            <ClassRow
              key={c.id}
              klass={{ id: c.id, name: c.name }}
              teachers={teachers}
              assignedTeachers={assignedTeachers}
              enrolledStudents={enrolledStudents}
            />
          );
        })}
      </div>
    </div>
  );
}
