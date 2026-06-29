// 어나더레드(Essentials) function_code → 구조화된 기술 효과.
// 공격기술은 effect_chance% 로, 변화기술(category=2)은 100% 로 적용한다.
// 모르는 코드는 효과 없음(기본 데미지/무효)으로 안전 처리.

export type StatKey =
  | "attack"
  | "defense"
  | "special_attack"
  | "special_defense"
  | "speed"
  | "accuracy"
  | "evasion";

export type StatusKind = "poison" | "badpoison" | "burn" | "paralyze" | "sleep" | "freeze" | "confuse";

export interface StatChange {
  stat: StatKey;
  stages: number; // + 상승 / - 하락
  target: "user" | "target";
}

export interface ParsedEffect {
  statChanges: StatChange[];
  status: StatusKind | null;
  statusTarget: "user" | "target";
  flinch: boolean;
  heal: "half" | "leech" | null; // half: 최대HP 절반 / leech: 준 데미지 절반 흡수
  recoil: number; // 준 데미지의 비율(0=없음)
  multiHit: { min: number; max: number } | null;
}

const EMPTY: ParsedEffect = {
  statChanges: [],
  status: null,
  statusTarget: "target",
  flinch: false,
  heal: null,
  recoil: 0,
  multiHit: null,
};

const STAT_TOKENS: [RegExp, StatKey][] = [
  [/SpAtk/g, "special_attack"],
  [/SpDef/g, "special_defense"],
  [/Attack/g, "attack"],
  [/Defense/g, "defense"],
  [/Speed|Spd/g, "speed"],
  [/Accuracy/g, "accuracy"],
  [/Evasion/g, "evasion"],
];

/** function_code 문자열을 효과로 해석 */
export function parseEffect(fnRaw: string | null | undefined): ParsedEffect {
  const fn = fnRaw ?? "";
  if (!fn || fn === "None") return EMPTY;

  const eff: ParsedEffect = { ...EMPTY, statChanges: [] };

  // 1) 능력 변화: (Raise|Lower)(User|Target)<Stat...><N>
  const re = /(Raise|Lower)(User|Target)((?:SpAtk|SpDef|Attack|Defense|Speed|Spd|Accuracy|Evasion)+)(\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fn)) !== null) {
    const dir = m[1] === "Raise" ? 1 : -1;
    const target = m[2] === "User" ? "user" : "target";
    const stages = dir * parseInt(m[4], 10);
    const seg = m[3];
    for (const [tok, stat] of STAT_TOKENS) {
      tok.lastIndex = 0;
      if (tok.test(seg)) eff.statChanges.push({ stat, stages, target });
    }
  }

  // 2) 상태이상
  if (/BadPoison/.test(fn)) eff.status = "badpoison";
  else if (/Poison/.test(fn)) eff.status = "poison";
  else if (/Burn/.test(fn)) eff.status = "burn";
  else if (/Paralyze/.test(fn)) eff.status = "paralyze";
  else if (/Sleep/.test(fn)) eff.status = "sleep";
  else if (/Freeze/.test(fn)) eff.status = "freeze";
  else if (/Confuse/.test(fn)) eff.status = "confuse";
  if (eff.status) eff.statusTarget = /ConfuseUser|SleepUser/.test(fn) ? "user" : "target";

  // 3) 풀린치
  if (/Flinch/.test(fn)) eff.flinch = true;

  // 4) 회복
  if (/HealUserHalfOfTotalHP|HealUserDependingOnWeather|HealUserFully/.test(fn)) eff.heal = "half";
  else if (/HealUserByHalfOfDamageDone|AbsorbHealth|DrainTarget/.test(fn)) eff.heal = "leech";

  // 5) 연속 공격
  if (/HitTwoToFiveTimes/.test(fn)) eff.multiHit = { min: 2, max: 5 };
  else if (/HitThreeTimes/.test(fn)) eff.multiHit = { min: 3, max: 3 };
  else if (/HitTwoTimes/.test(fn)) eff.multiHit = { min: 2, max: 2 };

  // 6) 반동
  if (/RecoilHalf/.test(fn)) eff.recoil = 0.5;
  else if (/RecoilThird/.test(fn)) eff.recoil = 1 / 3;
  else if (/RecoilQuarter/.test(fn)) eff.recoil = 0.25;

  return eff;
}

export const STATUS_KO: Record<StatusKind, string> = {
  poison: "독",
  badpoison: "맹독",
  burn: "화상",
  paralyze: "마비",
  sleep: "잠듦",
  freeze: "얼음",
  confuse: "혼란",
};

export const STAT_KO: Record<StatKey, string> = {
  attack: "공격",
  defense: "방어",
  special_attack: "특수공격",
  special_defense: "특수방어",
  speed: "스피드",
  accuracy: "명중",
  evasion: "회피",
};
