"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { post } from "./client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg font-semibold text-white/80 hover:bg-white/10 hover:text-white ${compact ? "p-2" : "px-3 py-2 text-sm"}`}
      onClick={async () => {
        await post("/api/auth/logout");
        router.push("/");
        router.refresh();
      }}
      aria-label="Switch account"
    >
      <ArrowLeftRight size={16} aria-hidden="true" />
      {!compact && "Switch account"}
    </button>
  );
}
