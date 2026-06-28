"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DailyLog {
  id: string;
  log_date: string;
  goal: string;
  photo_paths: string[];
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
}

const STATUS = {
  pending: { label: "검사 대기", dot: "bg-amber-400", ring: "ring-amber-300" },
  approved: { label: "통과", dot: "bg-green-500", ring: "ring-green-400" },
  rejected: { label: "반려", dot: "bg-red-500", ring: "ring-red-400" },
} as const;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarView({ studentId }: { studentId: string }) {
  const today = new Date();
  const todayStr = ymd(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(todayStr);

  const supabase = createClient();

  const load = useCallback(async () => {
    const start = ymd(new Date(year, month, 1));
    const end = ymd(new Date(year, month + 1, 0));
    const { data } = await supabase
      .from("daily_logs")
      .select("id, log_date, goal, photo_paths, status, reject_reason")
      .eq("student_id", studentId)
      .gte("log_date", start)
      .lte("log_date", end);

    const map: Record<string, DailyLog> = {};
    const firstPhotos: string[] = [];
    const photoDate: string[] = [];
    (data ?? []).forEach((l: any) => {
      map[l.log_date] = l;
      if (l.photo_paths?.length) {
        firstPhotos.push(l.photo_paths[0]);
        photoDate.push(l.log_date);
      }
    });
    setLogs(map);

    const t: Record<string, string> = {};
    if (firstPhotos.length) {
      const { data: signed } = await supabase.storage
        .from("homework-photos")
        .createSignedUrls(firstPhotos, 3600);
      (signed ?? []).forEach((s: any, i: number) => {
        if (s.signedUrl) t[photoDate[i]] = s.signedUrl;
      });
    }
    setThumbs(t);
  }, [year, month, studentId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(year, month, d)));

  return (
    <div className="space-y-4">
      {/* 월 이동 */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
          ‹
        </button>
        <h2 className="text-lg font-bold">
          {year}년 {month + 1}월
        </h2>
        <button onClick={nextMonth} className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`b${i}`} />;
          const log = logs[dateStr];
          const isToday = dateStr === todayStr;
          const isSel = dateStr === selected;
          const st = log ? STATUS[log.status] : null;
          return (
            <button
              key={dateStr}
              onClick={() => setSelected(dateStr)}
              className={`relative aspect-square rounded-lg border p-1 text-left text-xs transition ${
                isSel ? "border-poke-blue ring-2 ring-poke-blue/30" : "border-slate-200"
              } ${isToday ? "bg-poke-yellow/10" : "bg-white"} hover:border-poke-blue`}
            >
              <span className={`font-semibold ${isToday ? "text-poke-red" : "text-slate-600"}`}>
                {Number(dateStr.slice(-2))}
              </span>
              {thumbs[dateStr] && (
                <img
                  src={thumbs[dateStr]}
                  alt=""
                  className="absolute inset-x-1 bottom-1 top-5 h-auto w-auto rounded object-cover"
                  style={{ objectFit: "cover" }}
                />
              )}
              {st && (
                <span
                  className={`absolute right-1 top-1 h-2 w-2 rounded-full ${st.dot}`}
                  title={st.label}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 선택한 날짜 편집 패널 */}
      {selected && (
        <DayEditor
          key={selected}
          studentId={studentId}
          date={selected}
          log={logs[selected]}
          onSaved={load}
        />
      )}
    </div>
  );
}

function DayEditor({
  studentId,
  date,
  log,
  onSaved,
}: {
  studentId: string;
  date: string;
  log?: DailyLog;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [goal, setGoal] = useState(log?.goal ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<string[]>(log?.photo_paths ?? []);
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = log?.status === "approved"; // 통과된 날은 수정 불가

  useEffect(() => {
    (async () => {
      if (!existing.length) return setExistingUrls([]);
      const { data } = await supabase.storage
        .from("homework-photos")
        .createSignedUrls(existing, 3600);
      setExistingUrls((data ?? []).map((s: any) => s.signedUrl).filter(Boolean));
    })();
  }, [existing, supabase]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const newPaths: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${studentId}/daily/${date}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("homework-photos")
          .upload(path, file);
        if (upErr) throw new Error(upErr.message);
        newPaths.push(path);
      }
      const merged = [...existing, ...newPaths];
      const { error: dbErr } = await supabase.from("daily_logs").upsert(
        {
          student_id: studentId,
          log_date: date,
          goal,
          photo_paths: merged,
          status: "pending",
          submitted_at: new Date().toISOString(),
          reviewed_by: null,
          reviewed_at: null,
          reject_reason: null,
        },
        { onConflict: "student_id,log_date" },
      );
      if (dbErr) throw new Error(dbErr.message);
      setFiles([]);
      setExisting(merged);
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{date}</h3>
        {log && (
          <span className="text-xs text-slate-500">
            {STATUS[log.status].label}
          </span>
        )}
      </div>

      {log?.status === "rejected" && log.reject_reason && (
        <p className="mb-2 text-xs text-poke-red">반려 사유: {log.reject_reason}</p>
      )}

      <label className="block text-sm font-medium text-slate-700">오늘의 목표</label>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        disabled={locked}
        rows={2}
        placeholder="예: 수학 문제집 3쪽 풀기"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none disabled:bg-slate-50"
      />

      {existingUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {existingUrls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
            </a>
          ))}
        </div>
      )}

      {!locked && (
        <>
          <label className="mt-3 block text-sm font-medium text-slate-700">사진 추가</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm"
          />
          {error && <p className="mt-2 text-sm text-poke-red">{error}</p>}
          <button
            onClick={save}
            disabled={saving || (!goal.trim() && files.length === 0 && existing.length === 0)}
            className="mt-3 w-full rounded-xl bg-poke-red py-2.5 font-bold text-white hover:bg-poke-red/90 disabled:opacity-50"
          >
            {saving ? "저장 중..." : log ? "수정 후 다시 제출" : "이 날짜에 제출"}
          </button>
        </>
      )}
      {locked && (
        <p className="mt-3 rounded-lg bg-green-50 p-2 text-center text-sm text-green-700">
          통과된 기록이에요! 🎉
        </p>
      )}
    </div>
  );
}
