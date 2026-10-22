import Link from "next/link";
import type { ReactNode } from "react";
import { BellDot, Car, CheckCircle2, CircleEllipsis, Clock3, Hourglass, PawPrint, Scale, TriangleAlert, Volume2, type LucideIcon } from "lucide-react";

// Shared presentational pieces. Statuses always carry text and an icon,
// never colour alone.

export type Tone = "action" | "waiting" | "progress" | "done" | "review";

const TONE_STYLE: Record<Tone, { cls: string; Icon: LucideIcon }> = {
  action: { cls: "bg-coral-wash text-coral-ink ring-coral/60", Icon: BellDot },
  waiting: { cls: "bg-white text-ink-soft ring-line-strong", Icon: Hourglass },
  progress: { cls: "bg-[#fff6e0] text-[#7a5300] ring-[#f0d28a]", Icon: Clock3 },
  done: { cls: "bg-teal-wash text-teal-ink ring-teal/40", Icon: CheckCircle2 },
  review: { cls: "bg-navy text-white ring-navy", Icon: Scale },
};

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  const { cls, Icon } = TONE_STYLE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </span>
  );
}

const CATEGORY: Record<string, { Icon: LucideIcon; label: string }> = {
  NOISE: { Icon: Volume2, label: "Noise" },
  PARKING: { Icon: Car, label: "Parking" },
  PET: { Icon: PawPrint, label: "Pet" },
  OTHER: { Icon: CircleEllipsis, label: "Other" },
};

export function CategoryTile({ category, size = 40 }: { category: string; size?: number }) {
  const { Icon } = CATEGORY[category] ?? CATEGORY.NOISE;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-paper text-ink ring-1 ring-inset ring-line" style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={size * 0.48} strokeWidth={2} />
    </span>
  );
}

export const categoryName = (c: string) => CATEGORY[c]?.label ?? c;

const BUTTON = {
  primary: "bg-teal-ink text-white hover:bg-[#0d5b57] active:bg-navy shadow-sm disabled:bg-ink-faint disabled:shadow-none",
  dark: "bg-navy text-white hover:bg-navy-deep disabled:bg-ink-faint",
  secondary: "bg-white text-ink ring-1 ring-inset ring-line-strong hover:ring-ink/40 hover:bg-paper disabled:text-ink-faint",
  ghost: "text-teal-ink hover:bg-teal-wash disabled:text-ink-faint",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON; size?: "md" | "lg" };

export function Button({ children, variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
        size === "lg" ? "min-h-12 px-5 text-[15px]" : "min-h-11 px-4 text-sm"
      } ${BUTTON[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: keyof typeof BUTTON; className?: string }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${BUTTON[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-2xl bg-surface ring-1 ring-line ${className}`}>{children}</Tag>;
}

export function Callout({ tone = "info", icon: Icon, title, children }: { tone?: "info" | "privacy" | "danger"; icon?: LucideIcon; title?: string; children: ReactNode }) {
  const cls = {
    info: "bg-teal-wash text-[#0f4f4b] ring-teal/30",
    privacy: "bg-coral-wash text-coral-ink ring-coral/50",
    danger: "bg-[#fde8e8] text-[#8a1f1f] ring-[#f2b1b1]",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={`flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${cls}`}>
      {Icon && <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fde8e8] px-3.5 py-2.5 text-sm font-medium text-[#8a1f1f]">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 space-y-3 sm:mb-8">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
          <span aria-hidden="true">‹</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]">{title}</h1>
          {description && <div className="max-w-[65ch] text-[15px] text-ink-soft">{description}</div>}
        </div>
        {actions}
      </div>
    </header>
  );
}

const TZ = "Asia/Kuala_Lumpur";
export const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(d));
export const fmtDay = (d: Date | string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(d));
