"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile } from "@/lib/actions/profile";

export function AccountForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await updateMyProfile(name);
      if ("error" in res) return setErr(res.error);
      setMsg("저장했어요!");
      router.refresh();
    });
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700">표시 이름</label>
        <div className="mt-1 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="화면에 보일 이름"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
          <button
            onClick={save}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-poke-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
        {msg && <p className="mt-1 text-xs text-green-600">{msg}</p>}
        {err && <p className="mt-1 text-xs text-poke-red">{err}</p>}
      </div>

      <button
        onClick={logout}
        className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        로그아웃
      </button>
    </div>
  );
}
