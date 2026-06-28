"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  seedCatalog,
  setStarterOption,
  upsertShopListing,
  seedBattleData,
} from "@/lib/actions/catalog";

const SAMPLE = `{
  "species": [
    { "pokedex_number": 1, "name": "Bulbasaur", "name_ko": "이상해씨", "type1": "grass", "sprite": "1.png", "chain": "bulbasaur", "stage_order": 1, "min_level": 1 },
    { "pokedex_number": 2, "name": "Ivysaur", "name_ko": "이상해풀", "type1": "grass", "sprite": "2.png", "chain": "bulbasaur", "stage_order": 2, "min_level": 5 },
    { "pokedex_number": 4, "name": "Charmander", "name_ko": "파이리", "type1": "fire", "sprite": "4.png", "chain": "charmander", "stage_order": 1, "min_level": 1 }
  ]
}`;

export function SeedForm() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await seedCatalog(json);
      if ("error" in res) return setError(res.error);
      setMsg("카탈로그를 업데이트했어요.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">포켓몬 데이터 일괄 등록 (JSON)</h3>
      <p className="text-xs text-slate-500">
        각 종(species)에 진화 체인 키(chain), 단계(stage_order), 진화 레벨(min_level)을
        함께 적습니다. sprite 는 pokemon-sprites 버킷 안의 경로예요.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={10}
        placeholder={SAMPLE}
        className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:outline-none"
      />
      {error && <p className="text-sm text-poke-red">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setJson(SAMPLE)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600"
        >
          예시 채우기
        </button>
        <button
          onClick={submit}
          disabled={pending || !json.trim()}
          className="flex-1 rounded-lg bg-poke-blue py-2 font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
        >
          {pending ? "등록 중..." : "등록/업데이트"}
        </button>
      </div>
    </div>
  );
}

export function SeedBattleDataForm() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await seedBattleData(json);
      if ("error" in res) return setError(res.error);
      setMsg("배틀 데이터(기술/타입 상성)를 등록했어요.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">배틀 데이터 등록 (기술·타입 상성)</h3>
      <p className="text-xs text-slate-500">
        <code>data/pokemon/battle_data.json</code> 내용을 붙여넣으세요. (포켓몬 데이터 등록 후 1회)
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        placeholder='{ "moves": [...], "type_chart": {...} }'
        className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:outline-none"
      />
      {error && <p className="text-sm text-poke-red">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <button
        onClick={submit}
        disabled={pending || !json.trim()}
        className="w-full rounded-lg bg-poke-blue py-2 font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        {pending ? "등록 중..." : "배틀 데이터 등록"}
      </button>
    </div>
  );
}

export function StarterToggle({
  speciesId,
  isStarter,
}: {
  speciesId: string;
  isStarter: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      await setStarterOption(speciesId, !isStarter);
      router.refresh();
    });
  }
  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
        isStarter
          ? "bg-poke-red/10 text-poke-red"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {isStarter ? "스타터 ✓" : "스타터로"}
    </button>
  );
}

export function ShopForm({
  speciesId,
  listingId,
  currentPrice,
  isActive,
}: {
  speciesId: string;
  listingId?: string;
  currentPrice: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(currentPrice);
  const [active, setActive] = useState(isActive);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await upsertShopListing({ listingId, speciesId, price, isActive: active });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none"
      />
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        판매중
      </label>
      <button
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-poke-blue px-3 py-1 text-xs font-semibold text-white hover:bg-poke-blue/90 disabled:opacity-50"
      >
        저장
      </button>
    </div>
  );
}
