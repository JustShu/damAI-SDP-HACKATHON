import type { Category, ResponseType } from "../domain/constants";
import { detectAbuse, detectBadFaith, detectSafetyConcern } from "../domain/safety";
import type { MediatorProvider, NoticeInput, NoticeOutput, RelayInput, RelayOutput, Tone } from "./types";

// Built-in mediator: a rule-based engine that runs with no API key. It reads
// the report for intent, safety and concrete facts, then composes a neutral
// third-person notice. It never copies the reporter's wording into the notice.

const TZ = "Asia/Kuala_Lumpur";

export function describeWhen(d: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(d));
  const part = hour < 5 ? "late at night" : hour < 12 ? "in the morning" : hour < 18 ? "in the afternoon" : hour < 22 ? "in the evening" : "late at night";
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: TZ }).format(d);
  return `on ${day}, ${part}`;
}

// ---------------------------------------------------------------------------
// Fact extraction. Each rule maps reporter wording to a neutral phrase about
// what was observed, plus a practical, polite request that fits it.

type Rule = { re: RegExp; issue: string; ask: string };

const NOISE: Rule[] = [
  { re: /\b(?:karaoke|singing)\b/i, issue: "karaoke or singing", ask: "keep singing and karaoke to a considerate volume, especially after 10pm" },
  { re: /\b(?:music|speaker|bass|dj|song)\b/i, issue: "loud music", ask: "keep music at a considerate volume, especially after 10pm" },
  { re: /\b(?:party|guests|gathering|celebration|visitors)\b/i, issue: "noise from a gathering", ask: "keep gatherings at a considerate volume late in the evening" },
  { re: /\b(?:drill\w*|hammer\w*|renovat\w*|construction|sawing|grinding|banging)\b/i, issue: "renovation or construction noise", ask: "keep any renovation work within the community's permitted hours" },
  { re: /\b(?:shout\w*|yell\w*|scream\w*|argu\w*|fight\w*|quarrel\w*)\b/i, issue: "raised voices", ask: "keep voices down late in the evening where possible" },
  { re: /\b(?:engine|rev\w*|motorbike|motorcycle|exhaust)\b/i, issue: "vehicle engine noise", ask: "avoid revving engines for long periods, particularly at night" },
  { re: /\b(?:alarm|siren)\b/i, issue: "an alarm going off", ask: "check the alarm if it sounds for a long time" },
  { re: /\b(?:tv|television|movie|gaming)\b/i, issue: "a loud TV or games", ask: "keep the volume considerate late in the evening" },
  { re: /\b(?:thump\w*|stomp\w*|footsteps|knocking|furniture)\b/i, issue: "thumping or knocking sounds", ask: "be mindful of heavy footsteps or moving furniture late at night" },
  { re: /\b(?:noise|noisy|loud|sound|racket|disturbance)\b/i, issue: "noise", ask: "keep noise to a considerate level, particularly late in the evening" },
];

const PARKING: Rule[] = [
  { re: /\bdouble[- ]?park\w*\b/i, issue: "a vehicle reportedly double-parked", ask: "avoid double-parking so others can get in and out" },
  { re: /\b(?:block\w*|obstruct\w*|in front of|across)\b[^.]*\b(?:gate|entrance|driveway|exit|access|door|road)\b|\b(?:gate|driveway|entrance)\b[^.]*\bblock\w*\b/i, issue: "a vehicle reportedly obstructing access to a nearby entrance", ask: "keep neighbouring gates and entrances clear when parking" },
  { re: /\b(?:on|over)\s+(?:the\s+)?(?:grass|curb|kerb|pavement|walkway|sidewalk|footpath)\b/i, issue: "a vehicle reportedly parked on the walkway or verge", ask: "keep walkways and verges clear for pedestrians" },
  { re: /\b(?:lorry|truck|van|bus)\b/i, issue: "a large vehicle reportedly parked in a way that affects access", ask: "park larger vehicles where they don't affect neighbours' access" },
  { re: /\b(?:car|vehicle|park\w*|motorbike|motorcycle)\b/i, issue: "how a vehicle was parked nearby", ask: "keep shared parking areas and entrances clear" },
];

const PET: Rule[] = [
  { re: /\b(?:bark\w*|howl\w*)\b/i, issue: "a dog reportedly barking for long periods", ask: "check whether your dog is barking for long stretches, especially when it is home alone" },
  { re: /\b(?:poop\w*|poo|waste|feces|faeces|droppings|pee\w*|urin\w*)\b/i, issue: "pet waste reportedly left in a shared or neighbouring area", ask: "clean up after your pet when it is outside" },
  { re: /\b(?:loose|roam\w*|wander\w*|off[- ]?leash|unleashed|escap\w*|running around)\b/i, issue: "a pet reportedly roaming outside unattended", ask: "keep your pet within your property or on a leash" },
  { re: /\b(?:aggressive|bite|bit|biting|growl\w*|chas\w*|lunge\w*)\b/i, issue: "a dog reportedly behaving aggressively toward passers-by", ask: "keep your dog secured when people pass by" },
  { re: /\b(?:scratch\w*|dig\w*|smell\w*|odou?r)\b/i, issue: "a pet reportedly causing a nuisance near neighbouring homes", ask: "take reasonable steps so your pet does not affect neighbours" },
  { re: /\b(?:dog|cat|pet|puppy|kitten|animal)\b/i, issue: "a pet reportedly causing a disturbance", ask: "take reasonable steps so your pet does not disturb neighbours" },
];

// "Other": common neighbourhood issues. Anything not listed falls back to the
// reporter's own short topic (see topicRule).
const OTHER: Rule[] = [
  { re: /\b(?:rubbish|garbage|trash|litter\w*|bin|bins|refuse)\b/i, issue: "rubbish reportedly left outside in a way that affects neighbours", ask: "keep rubbish in closed bins and put it out on collection days" },
  { re: /\b(?:smoke|smoking|burn\w*|bbq|barbecue|fumes)\b/i, issue: "smoke reportedly drifting towards neighbouring homes", ask: "be mindful of where smoke drifts, especially near open windows" },
  { re: /\b(?:smell\w*|odou?r|stink\w*|stench)\b/i, issue: "an unpleasant smell reportedly coming from your property", ask: "check whether anything at your property could be causing a smell" },
  { re: /\b(?:leak\w*|dripping|drip\w*|water|aircon|air[- ]?con|overflow\w*|pipe)\b/i, issue: "water reportedly leaking or dripping onto a neighbouring area", ask: "check any pipes, gutters or air-conditioning units for leaks" },
  { re: /\b(?:tree|branch\w*|leaves|hedge|overgrown|plants?|roots?)\b/i, issue: "trees or plants reportedly overhanging or affecting a neighbouring area", ask: "trim any trees or plants that reach into shared or neighbouring areas" },
  { re: /\b(?:vandal\w*|scratch\w*|damag\w*|graffiti|broke|broken|dent\w*)\b/i, issue: "reported damage to a neighbour's property", ask: "share any context you may have about what happened" },
  { re: /\b(?:light\w*|glare|spotlight|floodlight)\b/i, issue: "bright outdoor lighting reportedly shining into a neighbouring home", ask: "angle or dim outdoor lights so they don't shine into neighbouring homes" },
  { re: /\b(?:mosquito\w*|stagnant|pest\w*|rats?|cockroach\w*)\b/i, issue: "a possible pest or stagnant-water issue reportedly near your property", ask: "check for standing water or anything that could attract pests" },
  { re: /\b(?:debris|materials|renovation waste|sand|cement|bricks?)\b/i, issue: "building materials or debris reportedly left in a shared area", ask: "keep building materials and debris off shared areas" },
];

const RULES: Record<Category, Rule[]> = { NOISE, PARKING, PET, OTHER };

// For "Other" reports that match no rule, describe the issue using the
// reporter's own short topic, which they approve as part of the notice.
function topicRule(topic: string): Rule {
  return { re: /$^/, issue: `a concern about "${topic}"`, ask: "take this into consideration" };
}

const LOCATIONS: { re: RegExp; phrase: string }[] = [
  { re: /\bgarage\b/i, phrase: "from the garage area" },
  { re: /\bbalcon(?:y|ies)\b/i, phrase: "from the balcony" },
  { re: /\b(?:back ?yard|garden)\b/i, phrase: "from the garden area" },
  { re: /\b(?:porch|front yard|compound)\b/i, phrase: "from the front of the home" },
  { re: /\b(?:upstairs|upper floor|rooftop|roof)\b/i, phrase: "from an upper floor" },
];

const REPEATED = /\b(?:again|every (?:night|day|weekend|morning|evening)|always|keeps?|repeatedly|several times|daily|nightly|all the time|many times)\b/i;
const IMPACT: { re: RegExp; phrase: string }[] = [
  { re: /\b(?:can'?t|couldn'?t|cannot|unable to)\s+(?:get|drive|take)\b[^.]*\b(?:car|vehicle|out)\b/i, phrase: "It reportedly made it difficult for a neighbour to get their vehicle in or out." },
  { re: /\b(?:couldn'?t|can'?t|cannot)\s+sleep|kept (?:me|us|everyone) (?:up|awake)|woke (?:me|us|the (?:baby|kids?))\b/i, phrase: "It reportedly kept a neighbour awake." },
  { re: /\b(?:can'?t|couldn'?t)\s+(?:work|study|concentrate|focus)\b/i, phrase: "It reportedly made it hard for a neighbour to work or study." },
];

const LONG = /\b(?:for hours|all night|all day|whole night|whole day|(?:\d+|two|three|four|five)\s*(?:hours|hrs))\b/i;

// Details that could point back to the reporter, or that a neutral notice leaves out.
const LEAK_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(?:house|unit|lot|no\.?)\s*\d+[a-z]?(?:'s)?(?:\s+(?:gate|door|driveway|porch|car|house))?/gi, reason: "Refers to a specific home" },
  { re: /\b(?:my|our)\s+\w+(?:\s+\w+)?/gi, reason: "Points back to you" },
  { re: /\b[A-Z]{1,3}\s?\d{2,4}\s?[A-Z]{0,2}\b/g, reason: "Looks like a vehicle plate" },
  { re: /\+?\d[\d\s-]{7,}\d/g, reason: "Phone number" },
];
const OPINION = /\b(?:rude|selfish|inconsiderate|disgusting|terrible|annoying|ridiculous|stupid|useless|so rude|sus|suspicious|on purpose|deliberately|obviously|must be|i think they)\b/gi;

function extractFacts(category: Category, text: string, topic?: string | null) {
  const matched =
    RULES[category].find((r) => r.re.test(text)) ??
    (category === "OTHER" && topic ? (RULES.OTHER.find((r) => r.re.test(topic)) ?? topicRule(topic)) : null);
  return {
    rule: matched,
    location: category === "NOISE" ? (LOCATIONS.find((l) => l.re.test(text))?.phrase ?? null) : null,
    repeated: REPEATED.test(text),
    long: LONG.test(text),
    impact: IMPACT.find((i) => i.re.test(text))?.phrase ?? null,
  };
}

function removedDetails(text: string) {
  const removed: NoticeOutput["removedDetails"] = [];
  for (const { re, reason } of LEAK_PATTERNS) for (const m of text.matchAll(re)) removed.push({ span: m[0].trim(), reason });
  for (const m of text.matchAll(OPINION)) removed.push({ span: m[0], reason: "Opinion or speculation kept out of a neutral notice" });
  return removed.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Composition. Each tone has several phrasings; `attempt` picks one, so
// Regenerate gives a genuinely different version.

const pick = <T,>(list: T[], attempt: number) => list[(attempt - 1) % list.length];

function composeNotice(category: Category, facts: ReturnType<typeof extractFacts>, when: string, tone: Tone, attempt: number) {
  const rule = facts.rule!;
  const issue = category === "NOISE" ? `${rule.issue}${facts.location ? ` ${facts.location}` : ""}, reportedly coming from your home` : rule.issue;
  const extra = [
    facts.long && !rule.issue.includes("long") ? "It was described as going on for an extended period." : "",
    facts.impact ?? "",
    facts.repeated ? "The neighbour mentioned it may have happened more than once." : "",
  ].filter(Boolean);

  if (tone === "BRIEF") {
    const open = pick(["A neighbour raised a concern about", "A concern was shared about", "There's been a report of"], attempt);
    return [
      `${open} ${issue} ${when}.`,
      facts.repeated ? "It may have happened more than once." : "",
      `Please ${rule.ask}.`,
      "Not independently verified — you can reply privately here.",
    ].filter(Boolean).join(" ");
  }

  if (tone === "FORMAL") {
    const open = pick(["Dear resident,", "Good day,", "Dear neighbour,"], attempt);
    const core = pick(
      [`A concern has been raised regarding ${issue} ${when}.`, `A report has been received concerning ${issue} ${when}.`, `This notice concerns a report of ${issue} ${when}.`],
      attempt,
    );
    return [
      `${open}\n\n${core}`,
      ...extra,
      `It would be appreciated if you could ${rule.ask}.`,
      "Please note that this report has not been independently verified. You may respond through this channel with any context or clarification.",
    ].join(" ");
  }

  const open = pick(["Hi there,", "Hello neighbour,", "Hi,"], attempt);
  const core = pick(
    [`a neighbour has let us know about ${issue} ${when}.`, `a concern has come in about ${issue} ${when}.`, `a nearby household mentioned ${issue} ${when}.`],
    attempt,
  );
  const ask = pick([`Could you please ${rule.ask}?`, `It would really help if you could ${rule.ask}.`, `When you can, please ${rule.ask}.`], attempt);
  return [
    `${open} ${core}`,
    ...extra,
    ask,
    pick(
      [
        "This hasn't been verified, and there may be context the neighbour isn't aware of. You're welcome to reply privately here.",
        "Nothing has been confirmed, and you can share your side privately through this channel.",
        "This is a report, not a finding. If there's context, you can reply privately here.",
      ],
      attempt,
    ),
  ].join(" ");
}

const CLARIFY_QUESTION: Record<Category, string> = {
  NOISE: "Could you describe the noise itself — for example what it sounded like (music, voices, drilling), roughly when it started and how long it went on? I only pass on specific, factual details.",
  PARKING: "Could you describe what happened with the vehicle — for example whether it blocked a gate or driveway, parked on a walkway, or was double-parked, and roughly how long it stayed?",
  PET: "Could you describe what the pet was doing — for example barking for a long time, roaming outside, or leaving waste — and roughly when it happened?",
  OTHER: "Could you describe what you noticed — what it was, where it was, roughly when it happened, and how it affected you? I only pass on specific, factual details.",
};

export function analyseReport(input: NoticeInput): NoticeOutput {
  const removed = removedDetails(input.rawText);
  const base = { caseSummary: "", noticeText: "", removedDetails: removed };

  // 1. Safety first: a possible child-welfare issue or threat is never mediated.
  const safety = detectSafetyConcern(input.rawText);
  if (safety) {
    return {
      ...base,
      outcome: "SAFETY",
      mediatorMessage:
        safety === "CHILD"
          ? "What you've described may involve a child's safety, so I won't send it as a neighbour notice. It has been passed to community management."
          : "What you've described may involve a threat or danger, so I won't send it as a neighbour notice. It has been passed to community management.",
    };
  }

  // 2. Good faith: the service is for specific incidents, not for targeting people.
  if (detectBadFaith(input.rawText)) {
    return {
      ...base,
      outcome: "DECLINE",
      mediatorMessage:
        "I can only pass on concerns about something specific that happened, not requests aimed at upsetting someone. If there was a real incident — for example noise, parking or a pet issue — tell me what happened, roughly when, and how it affected you.",
    };
  }

  // 3. Concrete detail: without it there is nothing neutral and factual to send.
  const facts = extractFacts(input.category, input.rawText, input.topic);
  if (!facts.rule) {
    return { ...base, outcome: "CLARIFY", mediatorMessage: CLARIFY_QUESTION[input.category] };
  }

  const noticeText = composeNotice(input.category, facts, describeWhen(input.occurredAt), input.tone, input.attempt);
  const notes = [
    `I described it as ${facts.rule.issue}`,
    facts.location ? "kept the location to their own home" : "",
    removed.length ? `left out ${removed.length} detail${removed.length === 1 ? "" : "s"} that could identify you or that read as opinion` : "",
  ].filter(Boolean);
  return {
    ...base,
    outcome: "NOTICE",
    caseSummary: facts.rule.issue,
    noticeText,
    mediatorMessage: `Here's a neutral version. ${notes.join(", ")}.`.replace(/, ([^,]*)\.$/, " and $1."),
  };
}

// ---------------------------------------------------------------------------
// Relay: turn the recipient's own words into a short third-person summary.

const THIRD_PERSON: [RegExp, string][] = [
  [/\bI'm\b/gi, "they're"],
  [/\bI am\b/gi, "they are"],
  [/\bI'll\b/gi, "they'll"],
  [/\bI will\b/gi, "they will"],
  [/\bI've\b/gi, "they've"],
  [/\bI'd\b/gi, "they'd"],
  [/\bI was\b/gi, "they were"],
  [/\bwe're\b/gi, "they're"],
  [/\bwe'll\b/gi, "they'll"],
  [/\bwe've\b/gi, "they've"],
  [/\bwe'd\b/gi, "they'd"],
  [/\bwe was\b/gi, "they were"],
  [/\bmyself\b/gi, "themselves"],
  [/\bourselves\b/gi, "themselves"],
  [/\b(?:my|our)\s+(?:son|daughter|kids?|children|husband|wife|mother|father|mum|mom|dad|brother|sister|family|maid|helper|driver|tenant)\b/gi, "someone in their household"],
  [/\b(?:my|our)\s+(?:friends?|guests?|visitors?|relatives?)\b/gi, "a guest of theirs"],
  [/\bI\b/g, "they"],
  [/\bwe\b/gi, "they"],
  [/\b(?:my|our)\b/gi, "their"],
  [/\b(?:me|us)\b/gi, "them"],
  [/\b(?:mine|ours)\b/gi, "theirs"],
];

const APOLOGY = /\b(?:sorry|apologi[sz]e|apologies|my bad|maaf)\b/i;
const COMMITMENT = /\b(?:will|'ll|going to|gonna|plan to|from now|won't|promise|make sure|try to|going forward|next time)\b/i;
const DENIAL = /\b(?:not us|wasn'?t us|not mine|wasn'?t mine|not ours|didn'?t|don'?t (?:have|own)|never|no dog|no car|wrong (?:house|home))\b/i;

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/[.!?]+$/, ""))
    .map((s) => s.replace(/^(?:ok(?:ay)?|alright|noted|sure|yes|hi|hello)\b[,!. ]*/i, ""))
    .filter((s) => s.length > 2 && !/^(?:sorry|maaf)\W*$/i.test(s));
}

// "I'm Aisyah", "this is Mr Tan": introductions identify the sender, so drop them.
const INTRO = /\b(?:I'm|I am|this is|my name is|it's)\s+(?:(?:Mr|Mrs|Ms|Mdm|Encik|Puan|Dr)\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[,.!-]*\s*/g;

function toThirdPerson(s: string) {
  let out = s.replace(INTRO, "").replace(/^(?:sorry|apologies|my bad|maaf)[,!. ]*/i, "");
  for (const [re, rep] of THIRD_PERSON) out = out.replace(re, rep);
  out = out.replace(/\bthey (?:was|am)\b/gi, "they were").replace(/\bthey has\b/gi, "they have").replace(/\bthey is\b/gi, "they are");
  return out.charAt(0).toLowerCase() + out.slice(1);
}

const joinClauses = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

const COMMIT_FALLBACK: Record<Category, string> = {
  PARKING: "they intend to keep neighbouring entrances clear when parking",
  NOISE: "they intend to keep noise to a considerate level",
  PET: "they intend to take steps so their pet does not disturb neighbours",
  OTHER: "they intend to take steps to address the concern",
};

export function summariseReply(input: RelayInput): RelayOutput {
  const all = sentences(input.text);
  const apologised = APOLOGY.test(input.text);
  const commits = all.filter((s) => COMMITMENT.test(s)).map(toThirdPerson);
  const context = all.filter((s) => !COMMITMENT.test(s)).map(toThirdPerson);
  const opener = apologised ? "The other household apologised and acknowledged the concern." : "The other household acknowledged the concern.";

  let relayText: string;
  switch (input.responseType as ResponseType) {
    case "COMMIT":
      relayText = [
        opener,
        context.length ? `They explained that ${joinClauses(context)}.` : "",
        `They said ${commits.length ? joinClauses(commits) : COMMIT_FALLBACK[input.category]}.`,
      ].filter(Boolean).join(" ");
      break;
    case "CLARIFY":
      relayText = context.length || commits.length
        ? `The other household shared some context: ${joinClauses([...context, ...commits])}. They asked for this to be taken into account.`
        : "The other household shared some context about the situation and asked for it to be taken into account.";
      break;
    case "DISPUTE": {
      const reason = all.filter((s) => DENIAL.test(s)).map(toThirdPerson);
      relayText = [
        "The other household disputes the concern as described.",
        reason.length ? `They said ${joinClauses(reason)}.` : context.length ? `They said ${joinClauses(context)}.` : "",
        "This doesn't confirm either account. If the issue continues, you can request a fair review by management.",
      ].filter(Boolean).join(" ");
      break;
    }
    default:
      relayText = [opener, all.length ? `They added that ${joinClauses(all.map(toThirdPerson))}.` : ""].filter(Boolean).join(" ");
  }
  return { relayText: relayText.replace(/\s+/g, " ").slice(0, 800), requiresModeration: detectAbuse(input.text) };
}

export const localProvider: MediatorProvider = {
  name: "built-in-v2",
  draftNotice: async (input) => analyseReport(input),
  draftRelay: async (input) => summariseReply(input),
};
