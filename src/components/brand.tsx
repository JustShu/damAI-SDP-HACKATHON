// Brand marks. The mediator has its own mark so residents always know when the
// AI is speaking, as opposed to a person or the system.

// DAMAI mark: two homes under one sheltering arc, with a small dove of peace
// (the mediator) between them. `onDark` keeps the signature gradient tile.
export function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const id = `damai-g-${size}-${onDark ? "d" : "l"}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b4cf0" />
          <stop offset="0.5" stopColor="#2f6fd6" />
          <stop offset="1" stopColor="#12b5a6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill={`url(#${id})`} />
      {onDark && <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="9.25" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />}
      {/* sheltering arc */}
      <path d="M5.5 17.5C8 10.5 24 10.5 26.5 17.5" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      {/* two homes */}
      <path d="M6.5 21.2 10 18.2l3.5 3V25h-7z" fill="#ffffff" />
      <path d="M18.5 21.2 22 18.2l3.5 3V25h-7z" fill="#ffffff" />
      {/* the dove between them */}
      <path d="M13.2 13.4c1.3-.2 2.2.3 2.8 1.2.6-1.8 2.1-2.7 4-2.6-1 .5-1.6 1.2-1.9 2.2.6.1 1.1.4 1.4.9-1.1-.2-2 0-2.7.6-.8.7-2 .9-3 .4.8-.1 1.4-.5 1.7-1.1-.6-.6-1.4-1-2.3-1.6z" fill="#ffffff" />
    </svg>
  );
}

/** "DAMAI" wordmark with the tagline. */
export function Wordmark({ onDark = false, tagline = true, size = "md" }: { onDark?: boolean; tagline?: boolean; size?: "md" | "lg" }) {
  return (
    <span className="leading-none">
      <span className={`block font-extrabold tracking-[0.18em] ${size === "lg" ? "text-[26px]" : "text-[18px]"} ${onDark ? "text-white" : "text-damai"}`}>DAMAI</span>
      {tagline && <span className={`mt-1 block text-[11px] font-semibold tracking-wide ${onDark ? "text-white/65" : "text-ink-soft"}`}>Neighbours at peace</span>}
    </span>
  );
}

export function MediatorAvatar({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-damai text-white"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20">
        <path d="M4 3.5h12A2.5 2.5 0 0 1 18.5 6v5a2.5 2.5 0 0 1-2.5 2.5h-4.2L10 16.5l-1.8-3H4A2.5 2.5 0 0 1 1.5 11V6A2.5 2.5 0 0 1 4 3.5z" fill="currentColor" />
        <circle cx="6.5" cy="8.5" r="1.1" fill="#12b5a6" />
        <circle cx="10" cy="8.5" r="1.1" fill="#12b5a6" />
        <circle cx="13.5" cy="8.5" r="1.1" fill="#12b5a6" />
      </svg>
    </span>
  );
}

const AVATAR_TONES = ["bg-[#dbe8f5] text-[#1d4f80]", "bg-[#e9e2f5] text-[#5a3c8a]", "bg-[#f6e6d8] text-[#8a4b1d]", "bg-[#dff0e4] text-[#2d6a3e]", "bg-[#f5dfe6] text-[#8a2d4c]"];

export function Avatar({ name, size = 36, dark = false }: { name: string; size?: number; dark?: boolean }) {
  const initials = name
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const tone = dark ? "bg-navy-line text-white" : AVATAR_TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
