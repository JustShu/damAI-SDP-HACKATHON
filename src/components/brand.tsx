// Brand marks. The mediator has its own mark so residents always know when the
// AI is speaking, as opposed to a person or the system.

export function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const roof = onDark ? "#ffffff" : "#142b45";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={onDark ? "#26405e" : "#e5f4f2"} />
      {/* two homes */}
      <path d="M5 19.5 9.5 15.5 14 19.5V25H5z" fill="none" stroke={roof} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 19.5 22.5 15.5 27 19.5V25h-9z" fill="none" stroke={roof} strokeWidth="1.8" strokeLinejoin="round" />
      {/* the mediator between them */}
      <path d="M11.5 6.5h9a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H17l-1 1.8-1-1.8h-3.5A2.5 2.5 0 0 1 9 12V9a2.5 2.5 0 0 1 2.5-2.5z" fill="#23a6a0" />
    </svg>
  );
}

export function MediatorAvatar({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-teal text-white"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20">
        <path d="M4 3.5h12A2.5 2.5 0 0 1 18.5 6v5a2.5 2.5 0 0 1-2.5 2.5h-4.2L10 16.5l-1.8-3H4A2.5 2.5 0 0 1 1.5 11V6A2.5 2.5 0 0 1 4 3.5z" fill="currentColor" />
        <circle cx="6.5" cy="8.5" r="1.1" fill="#23a6a0" />
        <circle cx="10" cy="8.5" r="1.1" fill="#23a6a0" />
        <circle cx="13.5" cy="8.5" r="1.1" fill="#23a6a0" />
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
