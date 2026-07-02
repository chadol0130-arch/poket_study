"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClass, assignTeacher, enrollStudent } from "@/lib/actions/classes";
import { StudentPicker } from "@/components/admin/StudentPicker";

interface Person {
  id: string;
  name: string;
}

export function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createClass(name);
      if ("error" in res) return setError(res.error);
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="새 반 이름 (예: 중2 수학 A반)"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={pending || !name.trim()}
        className="rounded-lg bg-poke-blue px-4 py-2 text-sm font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        반 만들기
      </button>
      {error && <p className="text-sm text-poke-red">{error}</p>}
    </div>
  );
}

export function ClassRow({
  klass,
  teachers,
  assignedTeachers,
  enrolledStudents,
}: {
  klass: Person;
  teachers: Person[];
  assignedTeachers: Person[];
  enrolledStudents: Person[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function addTeacher(teacherId: string) {
    if (!teacherId) return;
    startTransition(async () => {
      await assignTeacher(klass.id, teacherId);
      router.refresh();
    });
  }
  function addStudent(studentId: string) {
    if (!studentId) return;
    startTransition(async () => {
      await enrollStudent(klass.id, studentId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold">{klass.name}</h3>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-slate-500">선생님</p>
          <p className="text-sm">
            {assignedTeachers.map((t) => t.name).join(", ") || "—"}
          </p>
          <select
            disabled={pending}
            onChange={(e) => {
              addTeacher(e.target.value);
              e.target.value = "";
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
            defaultValue=""
          >
            <option value="">+ 선생님 배정</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500">
            학생 ({enrolledStudents.length}명)
          </p>
          <p className="text-sm">
            {enrolledStudents.map((s) => s.name).join(", ") || "—"}
          </p>
          <div className="mt-1">
            <StudentPicker
              multi={false}
              onPick={(p) => addStudent(p.id)}
              placeholder="+ 학생 등록 (이름 검색)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
