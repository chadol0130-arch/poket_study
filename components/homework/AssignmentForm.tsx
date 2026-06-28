"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment } from "@/lib/actions/assignments";

export function AssignmentForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [xpReward, setXpReward] = useState(50);
  const [coinReward, setCoinReward] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createAssignment({
        classId,
        title,
        description,
        xpReward,
        coinReward,
      });
      if ("error" in res) return setError(res.error);
      setTitle("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">새 숙제 만들기</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="숙제 제목"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
      />
      <div className="flex gap-3">
        <label className="flex-1 text-sm">
          경험치(XP)
          <input
            type="number"
            min={0}
            value={xpReward}
            onChange={(e) => setXpReward(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>
        <label className="flex-1 text-sm">
          코인
          <input
            type="number"
            min={0}
            value={coinReward}
            onChange={(e) => setCoinReward(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>
      </div>
      {error && <p className="text-sm text-poke-red">{error}</p>}
      <button
        onClick={submit}
        disabled={pending || !title.trim()}
        className="w-full rounded-lg bg-poke-blue py-2 font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        {pending ? "생성 중..." : "숙제 등록"}
      </button>
    </div>
  );
}
