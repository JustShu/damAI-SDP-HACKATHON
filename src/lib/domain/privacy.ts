import { createHash } from "crypto";

// Deterministic privacy scan for any text that leaves one private stream for
// another. It runs on every AI draft and every human edit, so the AI's own
// "identity leak" flags are never the only control (docs/04, docs/05).

export type Finding = {
  span: string;
  reason: string;
  // BLOCK: cannot be approved or sent. WARN: must be acknowledged by the sender.
  severity: "BLOCK" | "WARN";
};

export type ScanContext = {
  // Details that identify the sender and must never cross to the other side.
  senderHouseholdLabel: string;
  senderHouseholdUnit: string;
  senderName: string;
};

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /\+?\d[\d\s-]{7,}\d/g;
const HOUSE_REF = /\b(?:house|unit|lot|no\.?|#)\s*\d+[a-z]?(?:-\d+)?(?:'s)?/gi;
const PLATE = /\b[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,2}\b/g;
const FIRST_PERSON = /\b(?:my|mine|our|ours|I|I'm|I've|me|we)\b/gi;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matches(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re), (m) => m[0].trim()).filter(Boolean);
}

export function scanOutbound(text: string, ctx: ScanContext): Finding[] {
  const findings: Finding[] = [];
  const add = (span: string, reason: string, severity: Finding["severity"]) => {
    if (!findings.some((f) => f.span.toLowerCase() === span.toLowerCase())) {
      findings.push({ span, reason, severity });
    }
  };

  // 1. Hard identifiers of the sender: always blocked.
  const own = new RegExp(`\\b${escape(ctx.senderHouseholdLabel)}\\b`, "gi");
  for (const s of matches(text, own)) add(s, "Names your household", "BLOCK");
  const ownUnit = new RegExp(
    `\\b(?:house|unit|lot|no\\.?|#)\\s*${escape(ctx.senderHouseholdUnit)}\\b`,
    "gi",
  );
  for (const s of matches(text, ownUnit)) add(s, "Names your household", "BLOCK");
  if (ctx.senderName) {
    for (const part of ctx.senderName.split(/\s+/).filter((p) => p.length > 2)) {
      const re = new RegExp(`\\b${escape(part)}\\b`, "gi");
      for (const s of matches(text, re)) add(s, "Contains your name", "BLOCK");
    }
  }
  for (const s of matches(text, EMAIL)) add(s, "Contains an email address", "BLOCK");
  for (const s of matches(text, PHONE)) add(s, "Contains a phone number", "BLOCK");

  // 2. Indirect identifiers: allowed only with explicit acknowledgement.
  for (const s of matches(text, HOUSE_REF)) {
    add(s, "Mentions a specific home, which could point to who raised this", "WARN");
  }
  for (const s of matches(text, PLATE)) add(s, "Looks like a vehicle plate number", "WARN");
  for (const s of matches(text, FIRST_PERSON)) {
    add(s, "First-person wording can reveal who is speaking", "WARN");
  }
  return findings;
}

export const hasBlockers = (f: Finding[]) => f.some((x) => x.severity === "BLOCK");

// Replace blocked spans so an AI draft never carries a hard identifier.
export function redactBlocked(text: string, findings: Finding[]): string {
  let out = text;
  for (const f of findings.filter((x) => x.severity === "BLOCK")) {
    out = out.replace(new RegExp(escape(f.span), "gi"), "[removed]");
  }
  return out;
}

export const hashText = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
