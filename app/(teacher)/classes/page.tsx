import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherClassesPage() {
  const profile = await requireRole("teacher", "admin");
  const supabase = await createClient();

  let classes: any[] = [];
  if (profile.role === "admin") {
    const { data } = await supabase.from("classes").select("id, name").order("name");
    classes = data ?? [];
  } else {
    const { data: links } = await supabase
      .from("class_teachers")
      .select("class_id, classes(id, name)")
      .eq("teacher_id", profile.id);
    classes = (links ?? []).map((l: any) => l.classes).filter(Boolean);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">내 반</h1>

      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          담당하는 반이 없어요. 관리자에게 반 배정을 요청하세요.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/classes/${c.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-poke-blue"
              >
                <p className="text-lg font-semibold">{c.name}</p>
                <p className="text-sm text-slate-500">숙제 관리 / 학생 보기 →</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
