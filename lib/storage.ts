// 스토리지 경로/URL 헬퍼.

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** 공개 버킷(pokemon-sprites)의 퍼블릭 URL. */
export function spriteUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return `${BASE}/storage/v1/object/public/pokemon-sprites/${storagePath}`;
}
