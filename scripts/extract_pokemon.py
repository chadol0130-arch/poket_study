#!/usr/bin/env python3
"""
어나더레드(Pokémon Essentials v20+) 에셋 → 우리 앱 카탈로그 변환기.

입력 (git ref 의 블롭에서 직접 읽음, 기본 origin/main):
  - Data/species.dat                 (Ruby Marshal: 종 스탯/타입/진화)
  - Graphics/Pokemon/Front/<ID>.png  (애니메이션 시트)
  - Graphics/Pokemon/Icons/<ID>.png  (128x64 = 64x64 2프레임)

출력:
  - data/pokemon/gen1.json                 (관리자 '포켓몬 데이터' 등록용)
  - data/pokemon/sprites/front/<dex>.png   (정면 첫 프레임)
  - data/pokemon/sprites/icons/<dex>.png   (아이콘 첫 64x64)

사용법:
  pip install rubymarshal pillow
  python3 scripts/extract_pokemon.py            # 기본: 1세대(1..151)
  python3 scripts/extract_pokemon.py --max-dex 251 --ref origin/main
"""
import argparse
import io
import json
import os
import subprocess
import sys

from rubymarshal.reader import loads
from rubymarshal.classes import Symbol, RubyObject, RubyString
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 비(非)레벨 진화(돌/친밀도/통신 등)는 레벨 기반인 우리 시스템에 맞춰
# 단계별 기본 레벨로 치환한다.
DEFAULT_EVO_LEVEL = {2: 18, 3: 36}

# 1세대 표준 한글 도감명 (도감번호 기준)
KO_NAMES = {
    1: "이상해씨", 2: "이상해풀", 3: "이상해꽃", 4: "파이리", 5: "리자드",
    6: "리자몽", 7: "꼬부기", 8: "어니부기", 9: "거북왕", 10: "캐터피",
    11: "단데기", 12: "버터플", 13: "뿔충이", 14: "딱충이", 15: "독침붕",
    16: "구구", 17: "피죤", 18: "피죤투", 19: "꼬렛", 20: "레트라",
    21: "깨비참", 22: "깨비드릴조", 23: "아보", 24: "아보크", 25: "피카츄",
    26: "라이츄", 27: "모래두지", 28: "고지", 29: "니드런♀", 30: "니드리나",
    31: "니드퀸", 32: "니드런♂", 33: "니드리노", 34: "니드킹", 35: "삐삐",
    36: "픽시", 37: "식스테일", 38: "나인테일", 39: "푸린", 40: "푸크린",
    41: "주뱃", 42: "골뱃", 43: "뚜벅쵸", 44: "냄새꼬", 45: "라플레시아",
    46: "파라스", 47: "파라섹트", 48: "콘팡", 49: "도나리", 50: "디그다",
    51: "닥트리오", 52: "나옹", 53: "페르시온", 54: "고라파덕", 55: "골덕",
    56: "망키", 57: "성원숭", 58: "가디", 59: "윈디", 60: "발챙이",
    61: "슈륙챙이", 62: "강챙이", 63: "캐이시", 64: "윤겔라", 65: "후딘",
    66: "알통몬", 67: "근육몬", 68: "괴력몬", 69: "모다피", 70: "우츠동",
    71: "우츠보트", 72: "왕눈해", 73: "독파리", 74: "꼬마돌", 75: "데구리",
    76: "딱구리", 77: "포니타", 78: "날쌩마", 79: "야돈", 80: "야도란",
    81: "코일", 82: "레어코일", 83: "파오리", 84: "두두", 85: "두트리오",
    86: "쥬쥬", 87: "쥬레곤", 88: "질퍽이", 89: "질뻐기", 90: "셀러",
    91: "파르셀", 92: "고오스", 93: "고우스트", 94: "팬텀", 95: "롱스톤",
    96: "슬리프", 97: "슬리퍼", 98: "크랩", 99: "킹크랩", 100: "찌리리공",
    101: "붐볼", 102: "아라리", 103: "나시", 104: "탕구리", 105: "텅구리",
    106: "시라소몬", 107: "홍수몬", 108: "내루미", 109: "또가스", 110: "또도가스",
    111: "뿔카노", 112: "코뿌리", 113: "럭키", 114: "덩쿠리", 115: "캥카",
    116: "쏘드라", 117: "시드라", 118: "콘치", 119: "왕콘치", 120: "별가사리",
    121: "아쿠스타", 122: "마임맨", 123: "스라크", 124: "루주라", 125: "에레브",
    126: "마그마", 127: "쁘사이저", 128: "켄타로스", 129: "잉어킹", 130: "갸라도스",
    131: "라프라스", 132: "메타몽", 133: "이브이", 134: "샤미드", 135: "쥬피썬더",
    136: "부스터", 137: "폴리곤", 138: "암나이트", 139: "암스타", 140: "투구",
    141: "투구푸스", 142: "프테라", 143: "잠만보", 144: "프리져", 145: "썬더",
    146: "파이어", 147: "미뇽", 148: "신뇽", 149: "망나뇽", 150: "뮤츠", 151: "뮤",
}


def sym(x):
    return x.name if isinstance(x, Symbol) else x


def rstr(x):
    if isinstance(x, RubyString):
        return getattr(x, "text", None) or str(x)
    return x


def attrs(obj):
    """RubyObject 의 인스턴스 변수(@xxx)를 {이름: 값} 으로. (Symbol 키 비교 우회)"""
    return {sym(k).lstrip("@"): v for k, v in obj.attributes.items()}


def git_blob(ref, path):
    """git show <ref>:<path> 의 원시 바이트."""
    return subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        cwd=REPO_ROOT, capture_output=True, check=True,
    ).stdout


def first_frame(png_bytes, square=None):
    """애니메이션 시트(가로 N프레임)에서 첫 프레임을 잘라 PNG 바이트로 반환."""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = im.size
    side = square or h
    frame = im.crop((0, 0, side, side))
    out = io.BytesIO()
    frame.save(out, "PNG")
    return out.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default="origin/main")
    ap.add_argument("--max-dex", type=int, default=151)
    args = ap.parse_args()

    out_dir = os.path.join(REPO_ROOT, "data", "pokemon")
    front_dir = os.path.join(out_dir, "sprites", "front")
    icon_dir = os.path.join(out_dir, "sprites", "icons")
    for d in (front_dir, icon_dir):
        os.makedirs(d, exist_ok=True)

    print(f"species.dat 로드 ({args.ref}) ...")
    data = loads(git_blob(args.ref, "Data/species.dat"))
    items = list(data.items())

    # 전국도감 번호 = form==0 종의 등장 순서
    dex = 0
    by_dex = {}      # dex -> (id, attrs)
    id_to_dex = {}
    for k, v in items:
        a = attrs(v)
        if a.get("form", 0) != 0:
            continue
        dex += 1
        sid = sym(a.get("id"))
        by_dex[dex] = (sid, a)
        id_to_dex[sid] = dex

    # 정합성 체크: 알려진 도감번호와 ID 가 맞는지
    checks = {1: "BULBASAUR", 4: "CHARMANDER", 25: "PIKACHU", 151: "MEW"}
    for d, expect in checks.items():
        got = by_dex.get(d, (None,))[0]
        if got != expect:
            print(f"⚠️ 도감 순서 경고: #{d} 기대={expect} 실제={got}")

    target = {d: by_dex[d] for d in range(1, args.max_dex + 1) if d in by_dex}
    target_ids = {sid for sid, _ in target.values()}
    print(f"대상: {len(target)}종 (1..{args.max_dex})")

    # 진화 그래프 (대상 범위 내에서만)
    evo_from = {}     # id -> [(target_id, method, arg)]
    for d, (sid, a) in target.items():
        edges = []
        for e in a.get("evolutions", []):
            # Essentials 는 @evolutions 에 정방향+역방향(이전진화)을 모두 저장하고,
            # 4번째 불리언이 True 이면 '이전 진화'(역방향) 항목이다. 정방향만 사용.
            if len(e) > 3 and bool(e[3]):
                continue
            tid, method, arg = sym(e[0]), sym(e[1]), (e[2] if len(e) > 2 else None)
            if tid in target_ids:
                edges.append((tid, method, arg))
        evo_from[sid] = edges

    targeted = {t for edges in evo_from.values() for (t, _, _) in edges}

    # 선형 체인 구성: 분기(>1) 또는 비대상은 거기서 종료, 미배정 종은 단독 체인
    assigned = set()
    chains = []  # 각 원소: [(id, into_method, into_arg)]  (첫 단계 into=None)

    def is_base(sid):
        return sid not in targeted

    for d in sorted(target):
        sid, _ = target[d]
        if sid in assigned or not is_base(sid):
            continue
        chain = [(sid, None, None)]
        assigned.add(sid)
        cur = sid
        while True:
            edges = evo_from.get(cur, [])
            if len(edges) != 1:
                break  # 분기 또는 진화 없음 → 종료
            tid, method, arg = edges[0]
            if tid in assigned:
                break
            chain.append((tid, method, arg))
            assigned.add(tid)
            cur = tid
        chains.append(chain)

    # 분기 등으로 미배정된 종은 단독(단일 단계) 체인으로
    for d in sorted(target):
        sid, _ = target[d]
        if sid not in assigned:
            chains.append([(sid, None, None)])
            assigned.add(sid)

    # 체인 키 이름: 베이스 종의 영문 ID 소문자
    species_rows = []
    used_moves = set()
    for chain in chains:
        base_id = chain[0][0]
        chain_key = base_id.lower()
        for stage_order, (sid, method, arg) in enumerate(chain, start=1):
            d = id_to_dex[sid]
            a = target[d][1]

            # min_level 결정
            if stage_order == 1:
                min_level = 1
            elif method == "Level" and isinstance(arg, int):
                min_level = arg
            else:
                min_level = DEFAULT_EVO_LEVEL.get(stage_order, 40)

            types = [sym(t) for t in a.get("types", [])]
            base_stats = {sym(kk).lower(): vv for kk, vv in a.get("base_stats", {}).items()}

            # 레벨업 학습세트 [[level, MOVEKEY], ...]
            learnset = []
            for m in a.get("moves", []):
                lvl = m[0] if not isinstance(m[0], bool) else 1
                mv = sym(m[1])
                learnset.append([int(lvl), mv])
                used_moves.add(mv)

            # 스프라이트 추출
            front = git_blob(args.ref, f"Graphics/Pokemon/Front/{sid}.png")
            icon = git_blob(args.ref, f"Graphics/Pokemon/Icons/{sid}.png")
            with open(os.path.join(front_dir, f"{d}.png"), "wb") as f:
                f.write(first_frame(front))
            with open(os.path.join(icon_dir, f"{d}.png"), "wb") as f:
                f.write(first_frame(icon, square=64))

            species_rows.append({
                "pokedex_number": d,
                "name": rstr(a.get("real_name")) or sid.title(),
                "name_ko": KO_NAMES.get(d, ""),
                "type1": types[0].lower() if types else None,
                "type2": types[1].lower() if len(types) > 1 else None,
                "base_stats": base_stats,
                "sprite": f"front/{d}.png",
                "icon": f"icons/{d}.png",
                "chain": chain_key,
                "stage_order": stage_order,
                "min_level": min_level,
                "moves": learnset,
            })

    species_rows.sort(key=lambda r: r["pokedex_number"])
    payload = {"species": species_rows}
    json_path = os.path.join(out_dir, "gen1.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ {len(species_rows)}종 → {json_path}")
    print(f"   체인 {len(chains)}개, 스프라이트 {len(species_rows)*2}개 추출")
    missing_ko = [r["pokedex_number"] for r in species_rows if not r["name_ko"]]
    if missing_ko:
        print(f"⚠️ 한글명 누락 도감번호: {missing_ko}")

    # ---- 한글 메시지 팩 (기술 한글명/설명) ----
    # messages_kor_core.dat = list. idx 5 = 기술명(영문→한글), idx 6 = 기술설명(영문→한글)
    name_ko_map, desc_ko_map = {}, {}
    try:
        msgs = loads(git_blob(args.ref, "Data/messages_kor_core.dat"))
        if isinstance(msgs, list) and len(msgs) > 6:
            name_ko_map = {rstr(k): rstr(v) for k, v in (msgs[5] or {}).items()}
            desc_ko_map = {rstr(k): rstr(v) for k, v in (msgs[6] or {}).items()}
        print(f"한글 메시지 팩 로드: 기술명 {len(name_ko_map)} / 설명 {len(desc_ko_map)}")
    except Exception as e:
        print(f"⚠️ 한글 메시지 팩 로드 실패(영문 폴백): {e}")

    # ---- 배틀 데이터: 기술(moves) ----
    moves_data = loads(git_blob(args.ref, "Data/moves.dat"))
    move_rows = []
    for k, v in moves_data.items():
        key = sym(k)
        if key not in used_moves:
            continue
        ma = attrs(v)
        real_name = rstr(ma.get("real_name")) or key.title()
        real_desc = rstr(ma.get("real_description")) or ""
        move_rows.append({
            "key": key,
            "name_ko": name_ko_map.get(real_name, real_name),
            "power": int(ma.get("power") or 0),
            "type": (sym(ma.get("type")) or "NORMAL").lower(),
            "category": int(ma.get("category")) if ma.get("category") is not None else 2,
            "accuracy": int(ma.get("accuracy")) if ma.get("accuracy") is not None else 100,
            "pp": int(ma.get("total_pp") or 0),
            "description": desc_ko_map.get(real_desc, real_desc),
        })
    move_rows.sort(key=lambda m: m["key"])
    with open(os.path.join(out_dir, "moves.json"), "w", encoding="utf-8") as f:
        json.dump({"moves": move_rows}, f, ensure_ascii=False, indent=2)
    missing_moves = used_moves - {m["key"] for m in move_rows}
    print(f"✅ 기술 {len(move_rows)}개 → moves.json"
          + (f" (누락 {len(missing_moves)})" if missing_moves else ""))

    # ---- 배틀 데이터: 타입 상성표 ----
    types_data = loads(git_blob(args.ref, "Data/types.dat"))
    type_chart = {}
    for k, v in types_data.items():
        ta = attrs(v)
        key = sym(k).lower()
        type_chart[key] = {
            "weaknesses": [sym(x).lower() for x in ta.get("weaknesses", [])],
            "resistances": [sym(x).lower() for x in ta.get("resistances", [])],
            "immunities": [sym(x).lower() for x in ta.get("immunities", [])],
        }
    with open(os.path.join(out_dir, "type_chart.json"), "w", encoding="utf-8") as f:
        json.dump(type_chart, f, ensure_ascii=False, indent=2)
    print(f"✅ 타입 {len(type_chart)}개 → type_chart.json")

    # ---- 관리자 임포트용 통합 파일(한 번에 붙여넣기) ----
    with open(os.path.join(out_dir, "battle_data.json"), "w", encoding="utf-8") as f:
        json.dump({"moves": move_rows, "type_chart": type_chart}, f, ensure_ascii=False, indent=2)
    print("✅ 통합 → battle_data.json")


if __name__ == "__main__":
    main()
