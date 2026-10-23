# DAMAI · Neighbours at peace

*Jiran aman, hidup damai.* DAMAI is a phone-first hackathon prototype for handling neighbour concerns through private, AI-assisted mediation and human community management. **All residents, households, and incidents in the demo are synthetic.** This project is not affiliated with or endorsed by any property company.

## What the app does

- **Private neighbour mediation:** A resident reports a noise, parking, pet, or other concern. A mediator drafts a neutral notice; the reporter reviews and approves the exact text before it is sent. The other household replies privately and previews the summary relayed back. The reporter can then confirm whether the concern was resolved. Residents do not message each other directly.
- **Human review:** Safety concerns, requested reviews, overdue cases, and repeated qualifying incidents go to community management. The AI does not decide guilt or impose penalties. A manager records decisions and can reveal a reporter's identity only through an explicit, reasoned, logged action.
- **Repeat-incident warning drafts:** Three distinct, undisputed, unresolved incidents of the same category against one household within 30 days create a review flag and a draft warning letter. A manager sees a household report and must review, edit, and send the letter; nothing is sent automatically. Unrelated **Other** concerns do not count toward this repeat rule.
- **Urgent help (SOS):** A resident can send an urgent alert directly to management, outside the mediation flow. Management can acknowledge it, dispatch security with an ETA, and post status updates that appear on the resident's screen. The app is **not** an emergency service; if anyone is in danger, call local emergency services (the demo UI advises 999).
- **Mobile-first interface:** Phone navigation, a desktop sidebar, and an Add to Home Screen web-app manifest.

## Get started locally

### Prerequisites

- Node.js **20.9 or newer** and npm.
- No AI account or API key is needed for the built-in mediator.

Run the following from the project root (the directory containing `package.json`).

1. Copy the example environment file:

   ```sh
   # macOS / Linux
   cp .env.example .env
   ```

   ```powershell
   # Windows PowerShell
   Copy-Item .env.example .env
   ```

   In Windows Command Prompt, use `copy .env.example .env` instead. Edit `.env` and replace `SESSION_SECRET` with your own random secret of at least 32 characters. Keep `.env` private; it is gitignored.

2. Install dependencies and create the SQLite database with synthetic accounts and cases:

   ```sh
   npm ci
   npm run db:setup
   ```

   `db:setup` applies the Prisma schema and **re-seeds the demo database**, replacing existing demo data. The default `DATABASE_URL="file:./dev.db"` points to `prisma/dev.db` (the path is relative to `prisma/schema.prisma`). Run `npm run db:seed` only when you intentionally want to reset the demo data.

3. Start the app and visit `http://localhost:3000`:

   ```sh
   npm run dev
   ```

Choose a seeded account on the sign-in screen. Demo sign-in has no password or self-registration:

| Account | Role |
| --- | --- |
| `resident39@example.test` (Daniel Lim) | Resident, House 39 |
| `resident18@example.test` (Nur Aisyah) | Resident, House 18 |
| `manager@example.test` (Farah) | Community manager |

Other synthetic accounts, including an unverified invite, are also available on the sign-in screen. The manager interface includes a demo clock and a reset control; reset replaces current demo data.

### Optional: use an AI provider

The default `MEDIATOR_PROVIDER="auto"` uses Claude when `ANTHROPIC_API_KEY` is set, otherwise Gemini when `GEMINI_API_KEY` is set, otherwise the built-in rule-based mediator. Set `MEDIATOR_PROVIDER` to `local`, `claude`, or `gemini` to select explicitly. For example, in `.env`:

```dotenv
MEDIATOR_PROVIDER="gemini"
GEMINI_API_KEY="your-api-key"
```

For Claude, use `MEDIATOR_PROVIDER="claude"` and `ANTHROPIC_API_KEY`. Optional `GEMINI_MODEL` and `CLAUDE_MODEL` override the provider's model name; see `.env.example` for all variables. After editing `.env`, restart the dev server. Run `npm run ai:check` to test the selected provider with a **synthetic** report; this command calls the remote provider if one is selected and does not use the app's fallback. In the app, a failing or timed-out remote provider falls back to the built-in mediator. Provider keys remain server-side. The remote adapters have not been verified against live APIs in this prototype.

## Development and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run typecheck` | Check TypeScript types. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run Vitest unit and integration tests against a separate `prisma/test.db`. |
| `npm run db:setup` | Apply schema and replace the demo database with seeded data. |
| `npm run db:seed` | Replace demo data without applying schema changes. |
| `npm run ai:check` | Test the configured mediator with a synthetic input. |
| `npm run e2e` | Run Playwright browser tests against a production build on port 3100. |

For browser tests, install Chromium once, then build before running Playwright:

```sh
npx playwright install chromium
npm run build
npm run e2e
```

Playwright runs mobile and desktop projects and starts its own server on port 3100. The unit/integration test configuration uses a separate SQLite database and disables remote AI calls; browser tests exercise the seeded demo app, so avoid running them against data you want to retain.

## How it works

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 6 with SQLite, Zod, and signed `iron-session` cookies. Vitest covers domain logic and Playwright covers browser flows.
- **Code layout:** `src/app` contains pages and `src/app/api` contains route handlers. Server-side rules, permissions, privacy checks, and case state transitions live in `src/lib/domain`; mediator implementations live in `src/lib/mediator`. `prisma/schema.prisma` defines the data model; `src/lib/seed.ts` creates the synthetic demo data.
- **Privacy controls:** Access is checked on the server by person, household, and community. Reporter and recipient see separate private message streams. The server checks outgoing text for identifying details, even when an AI provider drafts it. Manager identity reveals require a recorded reason. These controls are prototype safeguards, not a guarantee of anonymity.
- **Notice integrity:** Approval is bound to the SHA-256 hash of a specific draft; editing or regenerating requires new approval. Sending uses an idempotency key and guarded state transitions to avoid duplicate delivery.
- **Deterministic escalation:** For noise, parking, and pet concerns, reports concerning the same household and category within a two-hour occurrence window share one incident. Only distinct incidents marked unresolved and not disputed count toward the 3-in-30-days manager review rule. A reply reminder is due after 72 hours; still-open cases are flagged after seven days. Time-based checks run on page loads and when the demo clock moves, with no background scheduler.

## Prototype limitations

- Demo sign-in has no passwords or real identity verification; seeded memberships are treated as verified. **Do not deploy this as a live resident or emergency system.**
- Keyword-based safety and abuse screening and the built-in rule-based mediator can produce false positives or miss problems; duplicate detection also uses a simple time window.
- SOS alerts are only useful if a community actively staffs management. There is no guaranteed real-time monitoring or dispatch integration.
- No outside-the-app notifications, attachments, Bahasa Melayu interface, or data retention/deletion controls are included.
- Reminder and repeat thresholds in `src/lib/domain/constants.ts` are configurable **demo defaults**, not validated community policy or legal advice.