import { ImageResponse } from "next/og";

// Home-screen icon for iPhone (PNG, generated from the DAMAI mark).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M5.5 17.5C8 10.5 24 10.5 26.5 17.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 21.2 10 18.2l3.5 3V25h-7z" fill="#fff"/><path d="M18.5 21.2 22 18.2l3.5 3V25h-7z" fill="#fff"/><path d="M13.2 13.4c1.3-.2 2.2.3 2.8 1.2.6-1.8 2.1-2.7 4-2.6-1 .5-1.6 1.2-1.9 2.2.6.1 1.1.4 1.4.9-1.1-.2-2 0-2.7.6-.8.7-2 .9-3 .4.8-.1 1.4-.5 1.7-1.1-.6-.6-1.4-1-2.3-1.6z" fill="#fff"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #5b4cf0 0%, #2f6fd6 50%, #12b5a6 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" width={180} height={180} src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`} />
      </div>
    ),
    { ...size },
  );
}
