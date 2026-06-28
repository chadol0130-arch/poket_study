// 포켓몬 타입·기술분류 한글 표기 + 타입별 색상 (표시용)

export const TYPE_KO: Record<string, string> = {
  normal: "노말",
  fire: "불꽃",
  water: "물",
  electric: "전기",
  grass: "풀",
  ice: "얼음",
  fighting: "격투",
  poison: "독",
  ground: "땅",
  flying: "비행",
  psychic: "에스퍼",
  bug: "벌레",
  rock: "바위",
  ghost: "고스트",
  dragon: "드래곤",
  dark: "악",
  steel: "강철",
  fairy: "페어리",
};

export function typeKo(type: string): string {
  return TYPE_KO[type?.toLowerCase()] ?? type ?? "";
}

// 타입별 배지 색 (tailwind 클래스)
export const TYPE_COLOR: Record<string, string> = {
  normal: "bg-stone-400",
  fire: "bg-orange-500",
  water: "bg-blue-500",
  electric: "bg-yellow-400",
  grass: "bg-green-500",
  ice: "bg-cyan-400",
  fighting: "bg-red-700",
  poison: "bg-purple-500",
  ground: "bg-amber-600",
  flying: "bg-indigo-400",
  psychic: "bg-pink-500",
  bug: "bg-lime-500",
  rock: "bg-stone-600",
  ghost: "bg-violet-700",
  dragon: "bg-indigo-700",
  dark: "bg-stone-800",
  steel: "bg-slate-500",
  fairy: "bg-pink-400",
};

export function typeColor(type: string): string {
  return TYPE_COLOR[type?.toLowerCase()] ?? "bg-slate-400";
}

// 기술 분류: 0 물리 / 1 특수 / 2 변화
export function categoryKo(category: number): string {
  if (category === 0) return "물리";
  if (category === 1) return "특수";
  return "변화";
}
