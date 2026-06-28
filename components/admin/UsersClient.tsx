"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAccount, setUserRole } from "@/lib/actions/admin";
import type { Role } from "@/lib/types/db";

const ROLE_LABEL: Record<Role, string> = {
  admin: "관리자",
  teacher: "선생님",
  student: "학생",
};

export function CreateUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await createUserAccount({ email, password, fullName, role });
      if ("error" in res) return setError(res.error);
      setMsg(`${fullName} (${ROLE_LABEL[role]}) 계정을 만들었어요.`);
      setEmail("");
      setPassword("");
      setFullName("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">계정 만들기</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="이름"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="student">학생</option>
          <option value="teacher">선생님</option>
          <option value="admin">관리자</option>
        </select>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="초기 비밀번호 (6자 이상)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-poke-red">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-poke-blue py-2 font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        {pending ? "생성 중..." : "계정 생성"}
      </button>
    </div>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function change(next: Role) {
    startTransition(async () => {
      await setUserRole(userId, next);
      router.refresh();
    });
  }
  return (
    <select
      defaultValue={role}
      disabled={pending}
      onChange={(e) => change(e.target.value as Role)}
      className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none"
    >
      <option value="student">학생</option>
      <option value="teacher">선생님</option>
      <option value="admin">관리자</option>
    </select>
  );
}
