import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// 몬스터볼 모양 앱 아이콘 (도형으로 그림 — 외부 에셋 불필요)
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#ffffff",
          border: "28px solid #111111",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "#ef5350" }} />
        <div style={{ position: "absolute", top: "228px", left: 0, right: 0, height: "56px", background: "#111111" }} />
        <div
          style={{
            position: "absolute",
            top: "166px",
            left: "166px",
            width: "150px",
            height: "150px",
            borderRadius: "50%",
            background: "#ffffff",
            border: "30px solid #111111",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
