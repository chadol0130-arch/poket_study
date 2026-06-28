/* eslint-disable @next/next/no-img-element */

/**
 * 스프라이트 이미지(없으면 플레이스홀더). 픽셀아트 보존을 위해 pixelated 렌더링.
 * silhouette=true 이면 도감 미보유 연출(검은 실루엣)로 표시한다.
 * (투명 PNG 라서 brightness(0) 이면 보이는 픽셀만 검게 → 실루엣)
 */
export function PokemonSprite({
  url,
  alt,
  size = 96,
  silhouette = false,
}: {
  url: string | null;
  alt: string;
  size?: number;
  silhouette?: boolean;
}) {
  if (!url) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-100 text-3xl"
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        ❓
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={silhouette ? "???" : alt}
      width={size}
      height={size}
      style={{
        imageRendering: "pixelated",
        width: size,
        height: size,
        ...(silhouette ? { filter: "brightness(0)", opacity: 0.85 } : {}),
      }}
      className="object-contain"
    />
  );
}
