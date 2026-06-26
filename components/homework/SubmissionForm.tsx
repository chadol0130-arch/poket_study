"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitHomework } from "@/lib/actions/submissions";

export function SubmissionForm({
  assignmentId,
  studentId,
  existingNote = "",
}: {
  assignmentId: string;
  studentId: string;
  existingNote?: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState(existingNote);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const paths: string[] = [];

      // 사진을 비공개 버킷의 본인 폴더에 업로드.
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${studentId}/${assignmentId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("homework-photos")
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError(`업로드 실패: ${upErr.message}`);
          return;
        }
        paths.push(path);
      }

      const res = await submitHomework({ assignmentId, note, photoPaths: paths });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/assignments");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">숙제 사진</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-1 block w-full text-sm"
        />
        {files.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">{files.length}개 선택됨</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">메모 (선택)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-poke-blue focus:outline-none"
          placeholder="선생님께 한마디"
        />
      </div>

      {error && <p className="text-sm text-poke-red">{error}</p>}

      <button
        onClick={submit}
        disabled={pending || files.length === 0}
        className="w-full rounded-xl bg-poke-red py-3 font-bold text-white hover:bg-poke-red/90 disabled:opacity-50"
      >
        {pending ? "제출 중..." : "숙제 제출하기"}
      </button>
    </div>
  );
}
