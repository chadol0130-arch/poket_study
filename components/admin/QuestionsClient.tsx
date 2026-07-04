"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuestion, setQuestionActive } from "@/lib/actions/questions";
import { StudentPicker, type PickerPerson } from "@/components/admin/StudentPicker";

interface Opt {
  id: string;
  name: string;
}

export function CreateQuestionForm({ classes }: { classes: Opt[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"open" | "choice">("open");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [xpReward, setXpReward] = useState(20);
  const [audience, setAudience] = useState<"all" | "class" | "students">("all");
  const [classId, setClassId] = useState("");
  const [selected, setSelected] = useState<PickerPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await createQuestion({
        body,
        kind,
        options: kind === "choice" ? options.filter((o) => o.trim()) : [],
        xpReward,
        audience,
        classId: audience === "class" ? classId : null,
        studentIds: audience === "students" ? selected.map((s) => s.id) : [],
      });
      if ("error" in res) return setError(res.error);
      setMsg("질문을 보냈어요! 학생 포켓몬에 ❗가 표시됩니다.");
      setBody("");
      setOptions(["", ""]);
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">질문 보내기</h3>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="예: 요즘 어떤 과목이 가장 어렵나요?"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          형식{" "}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "open" | "choice")}
            className="ml-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="open">주관식</option>
            <option value="choice">객관식</option>
          </select>
        </label>
        <label className="text-sm">
          경험치{" "}
          <input
            type="number"
            min={0}
            value={xpReward}
            onChange={(e) => setXpReward(Number(e.target.value))}
            className="ml-1 w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      {kind === "choice" && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">선택지</p>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={o}
                onChange={(e) =>
                  setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                }
                placeholder={`선택지 ${i + 1}`}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              {options.length > 2 && (
                <button
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg bg-slate-200 px-2 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="text-xs font-medium text-poke-blue"
          >
            + 선택지 추가
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">받는 대상</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { v: "all", l: "전체 학생" },
            { v: "class", l: "반 선택" },
            { v: "students", l: "개별 선택" },
          ].map((o) => (
            <label key={o.v} className="flex items-center gap-1">
              <input
                type="radio"
                name="audience"
                checked={audience === o.v}
                onChange={() => setAudience(o.v as any)}
              />
              {o.l}
            </label>
          ))}
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
                {c.name}
              </option>
            ))}
          </select>
        )}

        {audience === "students" && (
          <StudentPicker multi selected={selected} onChange={setSelected} />
        )}
      </div>

      {error && <p className="text-sm text-poke-red">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button
        onClick={submit}
        disabled={pending || !body.trim()}
        className="w-full rounded-lg bg-poke-blue py-2 font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        {pending ? "보내는 중..." : "질문 보내기"}
      </button>
    </div>
  );
}

export function QuestionActiveToggle({
  questionId,
  isActive,
}: {
  questionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      await setQuestionActive(questionId, !isActive);
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
      {isActive ? "진행중" : "마감됨"}
    </button>
  );
}
