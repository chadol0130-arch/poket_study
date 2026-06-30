import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS 홈 화면 아이콘 (몬스터볼)
export default function AppleIcon() {
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
          border: "10px solid #111111",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "#ef5350" }} />
        <div style={{ position: "absolute", top: "80px", left: 0, right: 0, height: "20px", background: "#111111" }} />
        <div
          style={{
            position: "absolute",
            top: "52px",
            left: "52px",
            width: "54px",
            height: "54px",
            borderRadius: "50%",
            background: "#ffffff",
            border: "11px solid #111111",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
