// 업로드 전 이미지 압축 (캔버스 기반, 외부 의존성 없음).
// 큰 폰 사진(5~10MB)을 긴 변 maxDim 이하 JPEG 로 줄여 업로드 속도·저장공간 절약.
// HEIC 등 디코드 실패 시 원본을 그대로 반환(안전).

export async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await loadImage(file);
    const iw = (bitmap as HTMLImageElement).naturalWidth || (bitmap as ImageBitmap).width;
    const ih = (bitmap as HTMLImageElement).naturalHeight || (bitmap as ImageBitmap).height;
    if (!iw || !ih) return file;

    const scale = Math.min(1, maxDim / Math.max(iw, ih));
    const w = Math.round(iw * scale);
    const h = Math.round(ih * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file; // 오히려 커지면 원본 유지
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
