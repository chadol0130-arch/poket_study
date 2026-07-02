"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PickerPerson {
  id: string;
  name: string;
}

/**
 * 학생 검색 픽커 — 전체 학생을 로드하지 않고 이름 검색(최대 30명)으로 고른다.
 * (관리자 RLS 로 profiles 조회. 1만 명 규모에서도 화면이 가볍게 유지)
 * - multi: 체크로 여러 명 담기(선택 칩 표시) → onChange(선택 목록)
 * - single: 클릭 즉시 onPick(1명) 호출 후 검색 초기화
 */
export function StudentPicker({
  multi = true,
  selected = [],
  onChange,
  onPick,
  placeholder = "학생 이름 검색",
}: {
  multi?: boolean;
  selected?: PickerPerson[];
  onChange?: (people: PickerPerson[]) => void;
  onPick?: (person: PickerPerson) => void;
  placeholder?: string;
}) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim().replace(/[%_]/g, "");
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("role", "student")
        .ilike("display_name", `%${term}%`)
        .order("display_name")
        .limit(30);
      if (error) {
        setErr("검색 실패: " + error.message);
        setResults([]);
      } else {
        setErr(null);
        setResults((data ?? []).map((p: any) => ({ id: p.id, name: p.display_name || "학생" })));
      }
      setSearching(false);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectedIds = new Set(selected.map((s) => s.id));

  function toggle(p: PickerPerson) {
    if (!multi) {
      onPick?.(p);
      setQ("");
      setResults([]);
      return;
    }
    const next = selectedIds.has(p.id)
      ? selected.filter((s) => s.id !== p.id)
      : [...selected, p];
    onChange?.(next);
  }

  return (
    <div className="space-y-2">
      {multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full bg-poke-blue/10 px-2 py-0.5 text-xs font-medium text-poke-blue"
            >
              {s.name}
              <button onClick={() => toggle(s)} className="text-poke-blue/60 hover:text-poke-blue">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none"
      />
      {err && <p className="text-xs text-poke-red">{err}</p>}

      {q.trim() && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {searching ? (
            <p className="text-xs text-slate-400">검색 중...</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-slate-400">검색 결과가 없어요.</p>
          ) : (
            results.map((p) =>
              multi ? (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggle(p)}
                  />
                  {p.name}
                </label>
              ) : (
                <button
                  key={p.id}
                  onClick={() => toggle(p)}
                  className="block w-full rounded px-1 py-0.5 text-left text-sm hover:bg-slate-50"
                >
                  {p.name}
                </button>
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
