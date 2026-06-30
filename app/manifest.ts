import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "포켓몬 숙제",
    short_name: "포켓몬숙제",
    description: "숙제하고 검사받으면 포켓몬이 자라는 학습 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ef5350",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
