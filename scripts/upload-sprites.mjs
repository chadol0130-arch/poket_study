// data/pokemon/sprites/** 를 pokemon-sprites 버킷에 일괄 업로드한다.
// 버킷 내 경로는 로컬 상대경로를 그대로 따른다 (front/1.png, icons/1.png ...).
//   사용법: npm run upload-sprites
// .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 사용.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SPRITES_DIR = join(ROOT, "data", "pokemon", "sprites");
const BUCKET = "pokemon-sprites";

function loadEnvLocal() {
  try {
    const txt = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env.local 없으면 실제 환경변수 사용 */
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 넣어주세요.");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".png")) out.push(p);
  }
  return out;
}

let files;
try {
  files = walk(SPRITES_DIR);
} catch {
  console.error(`❌ 스프라이트 폴더가 없습니다: ${SPRITES_DIR}`);
  console.error("   먼저 'python3 scripts/extract_pokemon.py' 로 추출하세요.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`${files.length}개 파일 업로드 시작 → 버킷 '${BUCKET}'`);
let ok = 0,
  fail = 0;
for (const file of files) {
  const path = relative(SPRITES_DIR, file).split("\\").join("/");
  const body = readFileSync(file);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: "image/png", upsert: true });
  if (error) {
    fail++;
    console.error(`  ✗ ${path}: ${error.message}`);
  } else {
    ok++;
    if (ok % 50 === 0) console.log(`  ... ${ok}개 완료`);
  }
}
console.log(`✅ 업로드 완료: 성공 ${ok}, 실패 ${fail}`);
if (fail > 0) process.exit(1);
