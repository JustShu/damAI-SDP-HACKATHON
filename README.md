# AI Neighbourhood Mediator (prototype)

Hackathon prototype for privacy-first, AI-mediated neighbour concerns. **All residents, homes and incidents are synthetic.** Not affiliated with or endorsed by any property company.

Resident A reports a concern → the AI mediator drafts a neutral notice → A reviews exactly what will be sent and approves it → Resident B replies privately to the mediator → the mediator relays a safe summary → A confirms resolution. Unresolved, repeated or unsafe cases go to a human manager. The AI never decides guilt or issues penalties.

## Run it locally

Requires Node.js 20+.

```bash
cp .env.example .env          # then set SESSION_SECRET to any random 32+ character string
npm install
npm run db:setup              # creates prisma/dev.db and loads the synthetic demo data
npm run dev                   # http://localhost:3000
```

**On Windows (Command Prompt)**, run these one at a time inside the `neighbourhood-mediator` folder (the one with `package.json`):

```bash
copy .env.example .env
```

```bash
npm install
```

```bash
npm run db:setup
```

```bash
npm run dev
```

Sign in by choosing a demo account; there is no password and no sign-up in demo mode.

## Using Gemini (real AI)

Without a key, the built-in mediator writes the notices. To use Google Gemini:

1. Create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Open `.env` (on Windows: `notepad .env`) and set:
   ```
   MEDIATOR_PROVIDER="gemini"
   GEMINI_API_KEY="paste-your-key-here"
   ```
3. Check the key works. This sends one made-up sample report to Gemini and prints the result, or the exact reason it failed:
   ```bash
   npm run ai:check
   ```
4. Restart `npm run dev` (Ctrl+C, then run it again).

The review screen shows who wrote each version: **"written by Gemini"** or **"written by the built-in mediator"**. If Gemini fails for a report (wrong key, model not available, usage limit, no internet), the built-in mediator writes it instead, so the reporter still gets a notice. The terminal running `npm run dev` prints Google's reason. If the model isn't available on your key, set `GEMINI_MODEL` in `.env`.

**Generating and regenerating:** after the first draft, the reporter can choose **Friendly / Formal / Brief** or press **Try another wording** as many times as they like. Each press makes a new version, and only the version they approve is sent.

## "Other" concerns

Besides Noise, Parking and Pet, residents can choose **Other** (rubbish, smoke, smells, leaks, trees, damage and so on). They add a short topic such as "Rubbish left outside", which can appear in the notice. The built-in mediator recognises common issues and otherwise describes the concern using that topic. Gemini and Claude get the topic too.

"Other" reports are never grouped together and never count toward the "3 in 30 days" rule, because they can be about unrelated things. The 72-hour reminder and 7-day overdue rules still apply.

| Account | Who | Use in the demo |
|---|---|---|
| Daniel Lim (`resident39@example.test`) | House 39 | Reporter |
| Nur Aisyah (`resident18@example.test`) | House 18 | Recipient |
| Priya Raman, Hafiz Osman | Houses 22 and 25 | Other reporters in the seeded history |
| Farah (`manager@example.test`) | Estate manager | Review queue, demo clock, reset |
| Invited (unverified) | House 41 | Shows that an unverified person gets no access |

## Six-minute demo script

1. **Daniel (House 39):** *Report a concern*, choose House 18 and parking, type something emotional like "House 18 keeps parking in front of my gate!! So rude. It's House 39's gate." The review screen shows your words with identifying details struck out next to the exact neutral notice. Tick the consent box, then *Approve and send*.
2. **Nur Aisyah (House 18):** open the shared concern ("reported, not a confirmed violation"). Choose *Propose an action*, write a reply, preview the summary that will be shared, then *Share this summary*.
3. **Daniel:** open the parking case, read the relayed summary (not House 18's own words), then *Mark as resolved*.
4. **Daniel:** open the seeded noise concern about House 18 and choose *Not resolved yet*. That makes the third separate unresolved noise incident in 30 days, so the case goes to management review. No warning is issued.
5. **Farah (manager):** open the flag. It lists the separate incidents (one was reported by two households but counts once), and the reporter's identity stays hidden unless revealed with a logged reason. Record a decision with a rationale and the rule applied.
6. **Farah:** *Advance 1 day*. The unanswered pet concern passes 7 days and an "Unresolved after 7 days" flag appears.

*Reset demo data* on the manager page restores everything for another run.

## Tests

```bash
npm test             # 51 unit/integration tests (Vitest, separate prisma/test.db)
npm run typecheck
npm run lint
npm run build && npx playwright install chromium && npm run e2e   # browser walkthrough of the demo above
```

Acceptance tests from `docs/10` mapped to `tests/`:

| Tests | File |
|---|---|
| T17, identity, household scoping | `phase0-identity.test.ts` |
| T01–T05, T15, T16, T18, T20 (send), AI failure | `phase1-reporter.test.ts` |
| T06–T08, abusive replies, relay privacy | `phase2-recipient.test.ts` |
| T09–T14, T19, T20 (flags), manager decisions and reveal logging | `phase3-escalation.test.ts` |
| Mediator: bad-faith decline, child safety, clarification, fact extraction, regenerate/tone, reply summaries | `phase4-mediator.test.ts` |
| "Other" concerns (topic, drafting, regenerate, no grouping/repeat counting), Gemini adapter and fallback | `phase5-other-and-ai.test.ts` |

## How it's built

- **Next.js + TypeScript + Tailwind**, with API routes in `src/app/api`. Each route resolves the user from a signed session cookie and calls one service in `src/lib/domain`.
- **SQLite + Prisma** (`prisma/schema.prisma`). To use Postgres, change `provider` and `DATABASE_URL`.
- **AI mediator** (`src/lib/mediator`): one `MediatorProvider` interface with three implementations:
  - **Built-in** (`local.ts`, default, no key needed): a rule-based engine that checks the report for safety and intent, extracts the facts (what, where, how often, the impact), writes a neutral notice in three tones with several wordings, and summarises the recipient's reply in the third person.
  - **Claude** (`claude.ts`): set `ANTHROPIC_API_KEY` in `.env`. It uses structured output, low effort and server-side refusal fallback.
  - **Gemini** (`gemini.ts`): set `GEMINI_API_KEY`. Google AI Studio has a free tier.

  Whichever writes the text, the server validates it with Zod and runs its own privacy and safety checks. If a remote AI fails, the built-in mediator takes over. The Claude and Gemini adapters have **not been tested against the live APIs** (no keys were available while building).

Key decisions:

- **The mediator can say no.** Some reports get no notice at all:
  - Reports about wanting to upset someone are declined.
  - Vague reports get a factual follow-up question.
  - Anything suggesting a threat or a risk to a child goes straight to management, with 999 / Talian Kasih 15999 guidance, and nothing reaches the neighbour.

  These screens run before any AI, so no provider can skip them.
- **The server enforces privacy, not the AI.** `privacy.ts` scans every outgoing text. It blocks the reporter's household, name, email or phone, and flags indirect details such as house numbers, plates and "my …" for explicit acknowledgement.
- **Approval is tied to an exact version.** Approving stores the SHA-256 of the exact text. Any edit or regeneration creates a new version, and sending re-checks the hash.
- **Sending can't be duplicated:** each send carries a unique idempotency key, and the state changes use compare-and-set updates.
- **Escalation uses fixed rules with no AI** (`incidents.ts`, `policy.ts`):
  - Reports about the same household and category within ±2 h share one incident.
  - An incident counts only if the reporter marked it unresolved and the recipient didn't dispute it.
  - 3 distinct counted incidents in a rolling 30 days raises a review flag.
  - A one-time reminder goes out at 72 h, and an overdue flag at 7 days.
  - Review flags are unique by key, so they are never created twice.
- **No cron:** the time rules run on page loads and whenever the demo clock moves.
- **Each side only sees their own messages.** Residents never message each other; each side only sees its own private stream.

## Prototype simplifications (honest limitations)

- The demo sign-in has no passwords or real identity verification. Memberships are seeded as already verified.
- Duplicate detection is a simple ±2 h window. A borderline case is not routed to a human.
- Safety and abuse screening is a keyword list (plus the provider's flag). It is broad on purpose and will have false positives and misses.
- Rate limiting is a simple per-person daily cap, and there is no enumeration protection beyond showing only your own community's homes.
- The built-in mediator is rule-based. It handles common noise, parking and pet reports well but can misread unusual wording. A real LLM (Claude or Gemini) handles open-ended reports better.
- Not included: Bahasa Melayu (P1), attachments (P2), notifications outside the app, and data retention/deletion.
- The policy values (72 h, 7 days, 3 in 30 days) are configurable demo defaults in `src/lib/domain/constants.ts`, not validated policy or legal advice.
