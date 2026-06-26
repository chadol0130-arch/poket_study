# 포켓몬 숙제 트래커 🐾

학생이 숙제를 제출하면 **선생님이 검사·승인**하고, 승인되는 순간 학생의 포켓몬이
**경험치와 코인**을 얻어 레벨업·진화합니다. 모은 코인으로 **상점에서 새 포켓몬을
수집**할 수 있습니다. (랭킹·배틀은 다음 단계)

> 🚀 **처음 설치하시나요?** 프로그래밍 지식 없이 브라우저만으로 따라 할 수 있는
> **[설치 가이드 → SETUP.md](./SETUP.md)** 를 먼저 보세요. (아래 내용은 개발자용입니다.)

## 기술 스택
- **Next.js 15 (App Router, TypeScript)** + **Tailwind CSS**
- **Supabase** (Postgres + Auth + Storage) — 역할 기반 RLS
- 배포: **Vercel**

## 주요 흐름
1. 관리자가 계정(선생님/학생)·반·포켓몬 데이터를 등록
2. 학생이 첫 포켓몬(**스타터**)을 직접 선택
3. 학생이 숙제를 사진으로 제출
4. 선생님이 **검사 큐**에서 통과 → DB 트리거가 경험치/코인 지급 → 레벨업·진화
5. 학생이 코인으로 **상점**에서 새 포켓몬 구입, 컬렉션에서 **대표** 전환

---

## 로컬 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. Supabase 준비
[Supabase CLI](https://supabase.com/docs/guides/cli) 가 필요합니다.

```bash
# 최초 1회 — config.toml 생성 (기존 migrations 는 유지됨)
supabase init

# 로컬 스택 시작 (Docker 필요)
supabase start

# 마이그레이션 + 시드 적용
supabase db reset
```

`supabase start` 가 출력하는 **API URL**, **anon key**, **service_role key** 를 복사합니다.

### 3. 환경변수
`.env.example` 을 복사해 `.env.local` 을 만들고 값을 채웁니다.
```bash
cp .env.example .env.local
```
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. 개발 서버
```bash
npm run dev
```
→ http://localhost:3000

### 테스트 계정 (시드, 비밀번호 모두 `password123`)
| 역할 | 이메일 |
|---|---|
| 관리자 | `admin@test.com` |
| 선생님 | `teacher@test.com` |
| 학생 | `s1@test.com`, `s2@test.com`, `s3@test.com` |

---

## 운영(Supabase Cloud) 배포

1. Supabase 프로젝트 생성 → `supabase link` 후 `supabase db push` 로 마이그레이션 적용
   (또는 SQL 에디터에 `supabase/migrations/*.sql` 을 순서대로 실행).
   **`seed.sql` 은 실행하지 마세요(테스트 계정 포함).**
2. Vercel 에 배포하고 환경변수 3개 설정.
3. **첫 관리자 만들기**: Supabase Authentication 에서 사용자를 추가한 뒤
   SQL 에디터에서:
   ```sql
   update public.profiles set role = 'admin' where id = '<user-uuid>';
   ```
   이후로는 `/admin/users` 화면에서 계정을 만들 수 있습니다.

---

## 포켓몬 데이터 등록 방법
1. **스프라이트 업로드**: Supabase Storage `pokemon-sprites` 버킷에 이미지 업로드
   (예: `1.png`, `4.png` …).
2. **데이터 등록**: 관리자 → **포켓몬 데이터** 화면에서 JSON 붙여넣기.
   각 종(species)이 자신의 진화 체인/단계/진화 레벨을 함께 선언합니다.
   ```json
   {
     "species": [
       { "pokedex_number": 1, "name": "Bulbasaur", "name_ko": "이상해씨",
         "type1": "grass", "sprite": "1.png", "chain": "bulbasaur",
         "stage_order": 1, "min_level": 1 },
       { "pokedex_number": 2, "name": "Ivysaur", "name_ko": "이상해풀",
         "sprite": "2.png", "chain": "bulbasaur", "stage_order": 2, "min_level": 5 }
     ]
   }
   ```
3. **스타터 / 상점** 화면에서 후보·가격을 설정합니다.

---

## 데이터 모델 / 성장 로직 요약
- 경험치는 **활성(대표) 포켓몬** 한 마리에만 쌓이고, `level_for_xp` 곡선으로 레벨이 정해집니다.
- 진화는 `evolution_stages.min_level` 데이터로 제어됩니다 (코드 수정 불필요).
- 승인 시 지급은 `submissions.status='approved'` 전이 트리거 → `award_for_submission` 함수가
  **트랜잭션·멱등**(원장 `xp_events`/`coin_events` 의 UNIQUE)으로 처리합니다.
- 상점 구입(`purchase_pokemon`), 스타터 선택(`choose_starter`), 대표 전환(`set_active_pokemon`)은
  모두 `SECURITY DEFINER` 함수로, 잔액 검증·소유권 확인을 서버에서 강제합니다.

## 명령어
```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run typecheck  # 타입 체크
npm run test       # 경험치 곡선 단위 테스트
```

## 다음 단계 (설계상 대비됨)
- **랭킹**: `student_pokemon.level` / `xp_events` 집계 (반·학원 단위)
- **배틀**: `base_stats` + `level` 기반 매칭 (`battles` 테이블 추가)
