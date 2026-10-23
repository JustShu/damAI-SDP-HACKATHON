"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Avatar } from "./brand";
import { post } from "./client";
import { ErrorText } from "./ui";

type Account = { email: string; displayName: string; role: string; household: string | null; membershipStatus: string | null };

// What each persona is for in the demo story.
const HINTS: Record<string, string> = {
  "resident39@example.test": "Raises the parking concern",
  "resident18@example.test": "Receives and replies",
  "resident22@example.test": "Earlier noise and pet reports",
  "resident25@example.test": "Reported the same noise as House 22",
  "hill18@example.test": "Another community with its own House 18",
  "invited41@example.test": "Invitation not verified, so no access",
  "manager@example.test": "Reviews flagged cases",
};

// Demo persona picker: signs in as a pre-verified synthetic account. There is
// deliberately no "enter your house number" path.
export function LoginList({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(email: string) {
    setBusy(email);
    setError(null);
    try {
      await post("/api/auth/login", { email });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  // Demo leads first, in the order the story uses them.
  const order = Object.keys(HINTS);
  const sorted = [...accounts].sort((x, y) => order.indexOf(x.email) - order.indexOf(y.email));
  const isMain = (a: Account) => a.role === "Resident" && a.membershipStatus === "VERIFIED" && !!a.household?.includes("Demo Park");
  const groups = [
    { title: "Residents of Demo Park", items: sorted.filter(isMain) },
    { title: "Community management", items: sorted.filter((a) => a.role === "Manager") },
    { title: "Edge cases", items: sorted.filter((a) => a.role === "Resident" && !isMain(a)) },
  ];

  return (
    <div className="space-y-6">
      <ErrorText message={error} />
      {groups.map((g) =>
        g.items.length ? (
          <section key={g.title} className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-soft">{g.title}</h3>
            <ul className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-line">
              {g.items.map((a) => (
                <li key={a.email} className="border-b border-line last:border-0">
                  <button
                    onClick={() => signIn(a.email)}
                    disabled={busy !== null}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-teal-wash active:bg-teal-wash disabled:opacity-60"
                  >
                    <Avatar name={a.displayName} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{a.displayName}</span>
                      <span className="block text-sm text-ink-soft">{a.role === "Manager" ? "Estate manager" : a.household?.split(",")[0]}</span>
                      {HINTS[a.email] && <span className="block text-xs text-ink-faint">{HINTS[a.email]}</span>}
                    </span>
                    {busy === a.email ? <Loader2 size={18} className="animate-spin text-teal-ink" aria-label="Signing in" /> : <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
