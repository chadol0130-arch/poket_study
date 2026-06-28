"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoss, setEncounterActive } from "@/lib/actions/encounters";

interface Opt {
  id: string;
  label: string;
}

export function CreateBossForm({
  species,
  classes,
}: {
  species: Opt[];
  classes: Opt[];
}) {
  const router = useRouter();
  const [speciesId, setSpeciesId] = useState("");
  const [level, setLevel] = useState(20);
  const [title, setTitle] = useState("");
  const [encounterDate, setEncounterDate] = useState("");
  const [audience, setAudience] = useState<"all" | "class">("all");
  const [classId, setClassId] = useState("");
  const [rewardXp, setRewardXp] = useState(200);
  const [rewardCoin, setRewardCoin] = useState(50);
  const [catchable, setCatchable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await createBoss({
        speciesId,
        level,
        title,
        encounterDate,
        audience,
        classId: audience === "class" ? classId : null,
        rewardXp,
        rewardCoin,
        catchable,
      });
      if ("error" in res) return setError(res.error);
      setMsg("보스를 배치했어요! 해당 날짜 학생 캘린더에 👑가 표시됩니다.");
      setTitle("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">보스 배치</h3>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          포켓몬
          <select
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">선택</option>
            {species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          레벨
          <input
            type="number"
            min={1}
            max={100}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          날짜 (예: 시험일)
          <input
            type="date"
            value={encounterDate}
            onChange={(e) => setEncounterDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          이름표 (선택)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="기말고사 보스"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          경험치 보상
          <input
            type="number"
            min={0}
            value={rewardXp}
            onChange={(e) => setRewardXp(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          코인 보상
          <input
            type="number"
            min={0}
            value={rewardCoin}
            onChange={(e) => setRewardCoin(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={catchable} onChange={(e) => setCatchable(e.target.checked)} />
        이기면 이 포켓몬을 잡을 수 있음
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">받는 대상</p>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={audience === "all"} onChange={() => setAudience("all")} />
            전체 학생
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={audience === "class"} onChange={() => setAudience("class")} />
            반 선택
          </label>
        </div>
        {audience === "class" && (
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">반을 선택하세요</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-poke-red">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button
        onClick={submit}
        disabled={pending || !speciesId || !encounterDate}
        className="w-full rounded-lg bg-poke-red py-2 font-semibold text-white hover:bg-poke-red/90 disabled:opacity-50"
      >
        {pending ? "배치 중..." : "보스 배치하기"}
      </button>
    </div>
  );
}

export function EncounterToggle({
  encounterId,
  isActive,
}: {
  encounterId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      await setEncounterActive(encounterId, !isActive);
      router.refresh();
    });
  }
  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
        isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {isActive ? "활성" : "비활성"}
    </button>
  );
}
