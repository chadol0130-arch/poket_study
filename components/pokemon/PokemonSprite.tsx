/* eslint-disable @next/next/no-img-element */

/** 스프라이트 이미지(없으면 플레이스홀더). 픽셀아트 보존을 위해 pixelated 렌더링. */
export function PokemonSprite({
  url,
  alt,
  size = 96,
}: {
  url: string | null;
  alt: string;
  size?: number;
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
      alt={alt}
      width={size}
      height={size}
      style={{ imageRendering: "pixelated", width: size, height: size }}
      className="object-contain"
    />
  );
}
