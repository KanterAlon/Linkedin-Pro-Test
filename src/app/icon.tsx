import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 30%, #60a5fa 0%, #1d4ed8 65%, #0f172a 100%)",
          color: "white",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        LP
      </div>
    ),
    size,
  );
}
