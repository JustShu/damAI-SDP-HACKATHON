// Keyword screens that run before (and regardless of) any AI. Deliberately
// broad: a false positive sends a case to a human, which is the safe failure.

const THREAT_PATTERNS = [
  /\bkill(?:ed|ing)?\b/i,
  /\b(?:hurt|harm|attack|assault|hit|stab|shoot|punch|beat)(?:s|ed|ing)?\s+(?:me|you|him|her|them|us|my)\b/i,
  /\bthreat(?:en|ened|ening|s)?\b/i,
  /\b(?:knife|gun|weapon|parang)\b/i,
  /\bviolen(?:t|ce)\b/i,
  /\b(?:on )?fire\b/i,
  /\b(?:bunuh|ugut|pukul)\b/i, // Bahasa Melayu: kill, threaten, hit
];

// A child mentioned alongside signs of possible harm. Never mediated as a
// neighbour dispute: it goes to a human with child-protection contacts.
const CHILD = /\b(?:child|children|kids?|boy|girl|baby|toddler|minor|under\s*\d{1,2}|budak|anak)\b/i;
const CHILD_HARM =
  /\b(?:moan\w*|abus\w*|beat(?:en|ing)?|hit(?:ting)?|slap\w*|hurt\w*|touch\w*|naked|sexual\w*|inappropriat\w*|bruis\w*|neglect\w*|locked (?:in|out)|left alone|sus|suspicious|grooming|help me|crying for help|screaming for help)\b/i;

const ABUSE_PATTERNS = [
  /\b(?:idiot|stupid|moron|bastard|bitch|asshole|bodoh|babi|sial)\b/i,
  /\bf+u+c+k+\w*/i,
  /\bshut up\b/i,
  /\bmind your own\b/i,
];

// The report is about wanting to harm or harass someone, not about an incident.
const BAD_FAITH_PATTERNS = [
  /\b(?:want|wanna|going|trying|plan(?:ning)?)\s+(?:to\s+)?(?:disturb|annoy|bother|harass|ruin|destroy|mess with|torment|punish)\b/i,
  /\b(?:disturb|ruin|destroy)\w*\s+(?:his|her|their|this guy'?s?|that guy'?s?)\s+life\b/i,
  /\bmake (?:his|her|their) life (?:hell|miserable)\b/i,
  /\b(?:get back at|revenge|teach (?:him|her|them) a lesson|make (?:him|her|them) (?:suffer|pay|move out|leave))\b/i,
  /\b(?:for fun|as a prank|just to annoy|for the lols?)\b/i,
  /\bi (?:just )?(?:hate|can'?t stand) (?:him|her|them|this guy|that guy|my neighbou?r)\b/i,
];

export type SafetyKind = "THREAT" | "CHILD";

export function detectSafetyConcern(text: string): SafetyKind | null {
  if (CHILD.test(text) && CHILD_HARM.test(text)) return "CHILD";
  if (THREAT_PATTERNS.some((p) => p.test(text))) return "THREAT";
  return null;
}

export const detectAbuse = (text: string) => ABUSE_PATTERNS.some((p) => p.test(text));
export const detectBadFaith = (text: string) => BAD_FAITH_PATTERNS.some((p) => p.test(text));
