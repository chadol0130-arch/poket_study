# 🚀 설치 가이드 (비개발자용)

이 문서만 따라 하면 **프로그래밍 지식 없이**, 컴퓨터에 아무것도 설치하지 않고
**웹 브라우저만으로** 포켓몬 숙제 트래커를 실제로 띄울 수 있어요.

전체 소요 시간: **약 20~30분**. 무료로 시작할 수 있습니다.

---

## ✅ 한눈에 보기 (체크리스트)

- [ ] 1단계. Supabase(데이터 저장소) 프로젝트 만들기
- [ ] 2단계. 데이터베이스 만들기 (SQL 2번 붙여넣기)
- [ ] 3단계. 내 관리자 계정 만들기
- [ ] 4단계. 열쇠(키) 3개 복사하기
- [ ] 5단계. Vercel(웹사이트 호스팅)로 배포하기
- [ ] 6단계. 관리자로 로그인 → 포켓몬·반·계정 등록

> 💡 막히면 맨 아래 **"문제 해결 / 자주 묻는 질문"** 을 보세요. 그래도 안 되면
> 저(Claude)에게 화면 캡처와 함께 물어보시면 같이 해결해 드려요.

---

## 1단계. Supabase 프로젝트 만들기

Supabase는 회원·데이터·사진을 저장하는 무료 백엔드예요.

1. https://supabase.com 접속 → **Start your project** → GitHub 또는 이메일로 가입
2. **New project** 클릭
3. 입력값:
   - **Name**: 아무 이름 (예: `pokemon-homework`)
   - **Database Password**: 비밀번호 입력 후 **꼭 따로 메모** (나중에 필요할 수 있음)
   - **Region**: `Northeast Asia (Seoul)` 추천
4. **Create new project** → 1~2분 기다리면 준비 완료

---

## 2단계. 데이터베이스 만들기 (SQL 2번 붙여넣기)

테이블·규칙을 한 번에 만드는 단계예요. 어렵지 않아요 — **복사 → 붙여넣기 → 실행**이 전부.

1. 왼쪽 메뉴에서 **SQL Editor**(`</>` 아이콘) 클릭 → **New query**
2. 이 저장소의 **`supabase/migrations/0001_init.sql`** 파일 내용을 전부 복사해서
   붙여넣고, 오른쪽 아래 **Run**(또는 Ctrl/Cmd+Enter) 클릭
   → "Success. No rows returned" 이 나오면 성공 ✅
3. 다시 **New query** → 이번엔 **`supabase/migrations/0002_storage.sql`** 내용을
   붙여넣고 **Run**
   → 사진 저장소(버킷) `homework-photos`, `pokemon-sprites` 가 자동으로 만들어져요 ✅
4. 한 번 더 **New query** → **`supabase/migrations/0003_sprite_icon_variant.sql`** 붙여넣고 **Run**
   → 포켓몬 아이콘 저장이 가능해져요 ✅
5. **New query** → **`supabase/migrations/0004_daily_logs.sql`** 붙여넣고 **Run**
   → 학습 캘린더(날짜별 기록) 기능이 켜져요 ✅
6. **New query** → **`supabase/migrations/0005_questions.sql`** 붙여넣고 **Run**
   → 포켓몬 "!" 질문 기능이 켜져요 ✅
7. **New query** → **`supabase/migrations/0006_engagement.sql`** 붙여넣고 **Run**
   → 연속 출석(스트릭)·데일리 미션·주간 랭킹이 켜져요 ✅
8. 마지막으로 **New query** → **`supabase/migrations/0007_battles.sql`** 붙여넣고 **Run**
   → 포켓몬 배틀(시험 보스전·야생 조우)이 켜져요 ✅

> 📌 GitHub에서 파일 내용 보는 법: 저장소에서 해당 파일을 클릭 → 오른쪽 위
> **Raw** 또는 복사 아이콘으로 전체 복사.

---

## 3단계. 내 관리자 계정 만들기

1. 왼쪽 메뉴 **Authentication** → **Users** → **Add user** → **Create new user**
2. 본인 **이메일**과 **비밀번호** 입력, **Auto Confirm User** 를 켜고 생성
3. 다시 **SQL Editor** → **New query** → 이 저장소의 **`supabase/create_admin.sql`**
   내용을 붙여넣되, 맨 위 `CHANGE_ME@example.com` 를 **방금 만든 이메일**로 바꾼 뒤 **Run**
   → 아래에 본인 이메일이 `role = admin` 으로 표시되면 성공 ✅

> 이제 이 계정이 "관리자"예요. 나머지 선생님·학생 계정은 나중에 **관리자 화면에서**
> 클릭 몇 번으로 만들 수 있어요(코드/SQL 필요 없음).

---

## 4단계. 열쇠(키) 3개 복사하기

웹사이트가 데이터베이스에 접속하려면 열쇠 3개가 필요해요.

1. 왼쪽 아래 **Project Settings**(톱니바퀴) → **API**
2. 다음 3가지를 메모장에 복사해 두세요:
   | 이름 | 화면에서의 위치 |
   |---|---|
   | **Project URL** | "Project URL" |
   | **anon key** (공개용) | "Project API keys" 의 `anon` `public` |
   | **service_role key** (비밀!) | "Project API keys" 의 `service_role` `secret` |

> ⚠️ **service_role key 는 비밀번호처럼 다루세요.** 절대 남에게 보내거나 공개 글에
> 올리지 마세요. (새 디자인의 Supabase에서는 "API Keys" 탭 아래에 있을 수 있어요.
> `anon` = 공개용, `service_role` = 비밀용 으로 생각하면 됩니다.)

---

## 5단계. Vercel로 배포하기 (웹사이트 주소 만들기)

Vercel은 이 앱을 인터넷에 띄워주는 무료 서비스예요.

1. https://vercel.com 접속 → GitHub로 가입/로그인
2. **Add New… → Project** → 이 GitHub 저장소(`poket_study`)를 **Import**
   - 만약 목록에 없으면 "Adjust GitHub App Permissions" 로 저장소 접근 허용
3. **Environment Variables**(환경 변수) 에 4단계에서 복사한 값 3개를 입력:
   | Key (이름) | Value (값) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | 복사한 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 복사한 anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | 복사한 service_role key |
4. **Deploy** 클릭 → 1~2분 후 `https://....vercel.app` 주소가 생기면 완성! 🎉

> Branch는 `claude/pokemon-homework-tracker-i4gryv` 또는 이 코드를 합친 `main` 중
> 배포할 브랜치를 고르면 됩니다.

---

## 6단계. 관리자로 로그인 → 등록 시작

배포된 `https://....vercel.app` 주소로 접속해 3단계에서 만든 관리자 계정으로 로그인하면
관리자 화면이 보여요. 순서대로 채워주세요:

1. **포켓몬 데이터** 화면
   - 먼저 Supabase **Storage → `pokemon-sprites`** 버킷에 포켓몬 이미지를 업로드해요
     (예: `1.png`, `4.png`, `7.png` …)
   - 그다음 화면의 칸에 아래 **JSON 양식**을 붙여넣고 등록
2. **스타터** 화면: 학생이 처음 고를 수 있는 포켓몬 3마리쯤 "스타터로" 지정
3. **상점** 화면: 코인으로 살 수 있는 포켓몬에 가격을 정하고 "판매중" 체크
4. **계정** 화면: 선생님·학생 계정 만들기 (이메일·초기 비밀번호·이름·역할)
5. **반 관리** 화면: 반을 만들고 선생님 배정 + 학생 등록

이제 선생님은 **검사 큐**에서 숙제를 통과시키고, 학생은 숙제를 올리며 포켓몬을 키워요!

### ⚡ 1세대 151마리 한 번에 넣기 (준비된 데이터)
직접 만들지 않아도, 1세대 151마리(스탯·타입·진화·**한글 이름**·정면/아이콘 스프라이트)가
이미 변환되어 `data/pokemon/` 에 들어 있어요.

1. **스프라이트 업로드** (로컬에서, 키 3개가 `.env.local` 에 있어야 함):
   ```bash
   npm run upload-sprites
   ```
   → `data/pokemon/sprites/` 의 302개 이미지가 `pokemon-sprites` 버킷에 올라갑니다.
2. **데이터 등록**: 관리자 → **포켓몬 데이터** 화면 칸에 `data/pokemon/gen1.json` 내용을
   전부 복사해 붙여넣고 등록.
3. 끝! **스타터/상점** 화면에서 원하는 포켓몬을 골라 설정하면 됩니다.

> ⚠️ 마이그레이션은 `0001` → `0002` → **`0003`** 순서까지 모두 실행해야 아이콘 저장이 됩니다.
> 더 많은 세대가 필요하면 `python3 scripts/extract_pokemon.py --max-dex 251` 처럼 늘릴 수 있어요.

### 포켓몬 데이터 등록 양식 (JSON) — 직접 만들 때
각 포켓몬마다 "어느 진화 라인(chain)인지", "몇 번째 단계(stage_order)인지",
"몇 레벨에 진화하는지(min_level)" 를 함께 적어요. `sprite` 는 버킷에 올린 파일 이름이에요.

```json
{
  "species": [
    { "pokedex_number": 1, "name": "Bulbasaur", "name_ko": "이상해씨",
      "type1": "grass", "sprite": "1.png",
      "chain": "bulbasaur", "stage_order": 1, "min_level": 1 },
    { "pokedex_number": 2, "name": "Ivysaur", "name_ko": "이상해풀",
      "type1": "grass", "sprite": "2.png",
      "chain": "bulbasaur", "stage_order": 2, "min_level": 5 },
    { "pokedex_number": 3, "name": "Venusaur", "name_ko": "이상해꽃",
      "type1": "grass", "sprite": "3.png",
      "chain": "bulbasaur", "stage_order": 3, "min_level": 12 }
  ]
}
```

> 💡 가지고 계신 이미지/엑셀을 저(Claude)에게 주시면, 이 JSON 형식으로 **자동 변환**해
> 드릴 수 있어요. "이미지/데이터 등록 준비" 를 부탁한다고 말씀만 하세요.

---

## (선택) 구글 로그인 켜기
로그인 화면의 **"구글로 로그인"** 버튼을 동작시키려면 아래 설정이 필요해요 (약 10~15분).

1. **Supabase URL 설정** — Authentication → **URL Configuration**
   - **Site URL** = 배포 주소 (예: `https://....vercel.app`)
   - **Redirect URLs**에 추가: `https://....vercel.app/auth/callback`
     (로컬 테스트도 하면 `http://localhost:3000/auth/callback` 도 추가)
2. **Supabase에서 콜백 URL 확인** — Authentication → **Providers → Google**
   - 화면에 표시되는 **콜백 URL**(`https://<프로젝트ref>.supabase.co/auth/v1/callback`)을 복사
3. **Google Cloud에서 OAuth 클라이언트 만들기** — https://console.cloud.google.com
   - 프로젝트 생성 → **APIs & Services → OAuth consent screen** 구성 (External, 앱 이름, 이메일)
   - **Credentials → Create Credentials → OAuth client ID → Web application**
   - **Authorized redirect URIs**에 2번에서 복사한 **Supabase 콜백 URL** 붙여넣기
   - 생성된 **Client ID / Client Secret** 복사
4. **Supabase에 입력** — Authentication → Providers → Google → **Enable** → Client ID/Secret 붙여넣고 **Save**
5. 끝! 로그인 화면의 "구글로 로그인" 버튼이 작동합니다.

> ⚠️ 구글로 **처음** 로그인한 사람은 자동으로 **'학생'** 으로 생성돼요. 선생님/관리자로 쓰려면
> 관리자가 **계정** 화면에서 역할을 바꿔주세요. 또 아무나 구글로 가입할 수 있으니, 외부 공개가
> 부담되면 구글 로그인은 끄고 **이메일 계정 발급만** 쓰셔도 됩니다.

## 문제 해결 / 자주 묻는 질문

**Q. 로그인했는데 화면이 비어 있거나 에러가 나요.**
→ Vercel 환경 변수 3개가 정확한지 확인하세요(특히 오타·앞뒤 공백). 변경 후에는
   Vercel에서 **Redeploy** 해야 반영됩니다.

**Q. 포켓몬 사진이 안 보여요(❓ 표시).**
→ (1) `pokemon-sprites` 버킷에 이미지를 올렸는지, (2) JSON의 `sprite` 이름이
   버킷의 파일 이름과 정확히 같은지 확인하세요.

**Q. 학생이 숙제를 올렸는데 선생님 검사 큐에 안 보여요.**
→ 그 학생이 **반에 등록**되어 있고, 그 반에 **선생님이 배정**되어 있는지 확인하세요.
   (관리자 → 반 관리)

**Q. "코인이 부족합니다" 가 떠요.**
→ 정상이에요. 숙제를 통과받아 코인을 모으면 상점에서 살 수 있어요.

**Q. service_role key 를 실수로 노출했어요.**
→ Supabase → Project Settings → API 에서 키를 **Reset(재발급)** 하고, Vercel 환경
   변수도 새 값으로 바꿔 Redeploy 하세요.

---

## (선택) 내 컴퓨터에서 먼저 시험해보기 — 개발자용

도커/CLI에 익숙하다면 로컬에서 테스트할 수 있어요. 자세한 건 [README.md](./README.md) 참고.

```bash
npm install
cp .env.example .env.local   # 4단계의 키 3개 입력
npm run dev                  # http://localhost:3000

# 관리자 계정을 명령어로 만들고 싶다면 (SQL 대신):
npm run create-admin -- admin@example.com 비밀번호123 관리자
```

로컬에서 `supabase`(CLI)로 `supabase db reset` 을 하면 테스트 계정·샘플 포켓몬이
자동으로 들어가, 바로 전체 흐름을 눌러볼 수 있어요(README 참고).
