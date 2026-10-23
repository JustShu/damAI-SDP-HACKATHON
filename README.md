# DAMAI · Neighbours at peace

*Jiran aman, hidup damai.*

DAMAI is a phone-first web app that helps neighbours resolve everyday concerns like noise, parking and pets through **private, AI-assisted mediation**, with **human community management** for anything serious. Residents never message each other directly. An AI mediator rewrites each complaint into a neutral, privacy-safe notice, the reporter approves the exact text, and the other household replies privately. Repeated issues, safety concerns and urgent SOS alerts go to a community manager.

> Built for the SDP Hackathon. **All residents, households and incidents in the demo are synthetic.** This project is not affiliated with or endorsed by any property company.

---

## ✨ Features

| Feature | What it does |
| --- | --- |
| 🤝 **Private neighbour mediation** | A resident reports a noise, parking, pet or other concern. The AI mediator drafts a neutral notice, the reporter reviews and approves it, and the other household replies privately. The reporter then confirms whether the concern was resolved. |
| 🧑‍⚖️ **Human review, not AI verdicts** | Safety concerns, overdue cases and repeat incidents are flagged to a community manager. The AI never decides guilt or issues penalties. Revealing a reporter's identity needs an explicit, reasoned and logged manager action. |
| 📄 **Repeat-incident warning drafts** | Three distinct, undisputed, unresolved incidents of the same category against one household within 30 days create a review flag and a **draft** warning letter. A manager must review, edit and send it. Nothing is sent automatically. |
| 🚨 **Urgent help (SOS)** | Residents can send an urgent alert straight to management. Managers acknowledge it, dispatch security with an ETA and post live status updates. *(Not an emergency service. In danger, call 999.)* |
| 🔒 **Privacy by design** | Separate private message streams, server-side permission checks, identifying-detail screening on all outgoing text and an append-only audit log. |
| 🧠 **Pluggable AI mediator** | Works with **Google Gemini**, **Anthropic Claude** or a built-in rule-based mediator that needs no API key. If a remote AI fails, the app falls back to the built-in one automatically. |
| 📱 **Mobile-first** | Phone navigation, a desktop sidebar and an installable *Add to Home Screen* web-app manifest. |

## 🛠️ Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 + SQLite · Zod · iron-session · Vitest · Playwright

---

## 🚀 Local setup (step by step)

### 1. Install the prerequisites

- **Node.js 20.9 or newer** (includes npm). Download it from <https://nodejs.org> (choose the LTS version).
- **Git** (optional, for cloning). Download it from <https://git-scm.com>.

Check that both are installed:

```sh
node -v    # should print v20.9.0 or higher
npm -v
```

### 2. Download the project to your computer

Pick **one** of these options.

**Option A: with Git (recommended)**

Open a terminal and run:

```sh
git clone https://github.com/JustShu/damAI-SDP-HACKATHON.git
cd damAI-SDP-HACKATHON
```

`git clone` downloads the project, and `cd` moves you into the project folder.

**Option B: as a ZIP (no Git needed)**

1. Open <https://github.com/JustShu/damAI-SDP-HACKATHON>.
2. Click the green **Code** button, then **Download ZIP**.
3. Right-click the downloaded ZIP and choose **Extract All** (on Mac, double-click it).
4. Open the extracted `damAI-SDP-HACKATHON-main` folder (the one that contains `package.json`).
5. Open a terminal in that folder:
   - **Windows:** click the address bar in File Explorer, type `cmd` and press **Enter**.
   - **Mac:** right-click the folder and choose **New Terminal at Folder**.

> All of the commands below must be run from this project folder.

### 3. Create your `.env` file

Copy the example environment file:

```sh
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bat
:: Windows Command Prompt
copy .env.example .env
```

### 4. Set a session secret

Open `.env` in a text editor and replace the `SESSION_SECRET` value with a random string of **at least 32 characters**. This command generates one on any OS:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `.env`:

```dotenv
SESSION_SECRET="paste-the-generated-value-here"
```

> 🔐 `.env` is listed in `.gitignore`. **Never commit it** or share your keys.

### 5. Install dependencies

```sh
npm ci
```

(`npm install` also works if `npm ci` complains about the lockfile.)

### 6. Create the database with demo data

```sh
npm run db:setup
```

This creates a local SQLite database at `prisma/dev.db` and fills it with synthetic residents, households and cases.

> ⚠️ Re-running `db:setup` or `db:seed` **resets** all demo data.

### 7. Start the app

```sh
npm run dev
```

Open **<http://localhost:3000>** in your browser.

### 8. Sign in with a demo account

Demo sign-in has no passwords. Just pick an account on the sign-in screen:

| Account | Role |
| --- | --- |
| `resident39@example.test` (Daniel Lim) | Resident, House 39 |
| `resident18@example.test` (Nur Aisyah) | Resident, House 18 |
| `manager@example.test` (Farah) | Community manager |

**Try this flow:** sign in as Daniel → report a concern about House 18 → approve the notice → sign out → sign in as Nur Aisyah → reply → sign in as Farah to see the manager view. The manager screen also has a **demo clock** for jumping time forward to trigger reminders and flags, plus a **reset** button.

The app works fully at this point using the built-in mediator. Adding an AI key (below) is optional.

---

## 🤖 Gemini AI API key setup (optional)

Gemini gives the mediator more natural, context-aware wording. Google AI Studio has a **free tier**.

### 1. Create an API key

1. Go to **<https://aistudio.google.com/apikey>**.
2. Sign in with your Google account and accept the terms if asked.
3. Click **Create API key**. Pick an existing Google Cloud project or let AI Studio create one for you.
4. **Copy** the key. Keep it private.

### 2. Add the key to `.env`

Open `.env` and set:

```dotenv
MEDIATOR_PROVIDER="gemini"
GEMINI_API_KEY="paste-your-key-here"
```

You can also leave `MEDIATOR_PROVIDER="auto"`. Auto mode uses Claude if `ANTHROPIC_API_KEY` is set, otherwise Gemini if `GEMINI_API_KEY` is set, otherwise the built-in mediator.

**Optional: choose a model.** The default is `gemini-3.1-flash-lite`. Model names change over time, so if you get a "model not found" error, check the current Flash model name in AI Studio and set it:

```dotenv
GEMINI_MODEL="the-current-flash-model-name"
```

### 3. Test the connection

```sh
npm run ai:check
```

This sends **one synthetic sample report** straight to Gemini, with no fallback, and prints the result. A successful run looks like:

```text
MEDIATOR_PROVIDER = "gemini"  →  using: gemini:gemini-3.1-flash-lite
GEMINI_API_KEY    = set
...
✓ The AI works (gemini:..., 1.8s). Outcome: NOTICE
```

### 4. Restart the app

Stop the dev server (`Ctrl + C`) and start it again so it picks up the new `.env`:

```sh
npm run dev
```

New notice drafts are now written by Gemini. Your API key stays on the server and is never sent to the browser.

### Troubleshooting Gemini

| Error from `ai:check` | What to do |
| --- | --- |
| `Gemini API error 400` | The key is wrong or missing. Re-copy it into `GEMINI_API_KEY` with no extra spaces. |
| `Gemini API error 403` | This key or project can't use the model or API. Check the key in AI Studio, or try another model. |
| `Gemini API error 404` | The model name doesn't exist. Set `GEMINI_MODEL` to a current model from AI Studio. |
| `Gemini API error 429` | You've hit the free-tier rate limit. Wait a minute and retry. |
| `Gemini API error 5xx` / `AI timeout` | Temporary Google issue. Retry later. The app falls back to the built-in mediator meanwhile. |
| `using: built-in` | The key wasn't picked up. Make sure you edited `.env` (not `.env.example`) and that `GEMINI_API_KEY` isn't empty. |

### Using Claude instead

```dotenv
MEDIATOR_PROVIDER="claude"
ANTHROPIC_API_KEY="your-anthropic-key"
# CLAUDE_MODEL="claude-opus-5-5"
```

Get a key at <https://console.anthropic.com>.

---

## 🧪 Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm run start` | Build and serve a production build |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests (uses a separate `prisma/test.db`, with remote AI disabled) |
| `npm run db:setup` | Apply the schema and reseed the demo database |
| `npm run db:seed` | Reseed demo data only |
| `npm run ai:check` | Test the configured AI provider |
| `npm run e2e` | Run Playwright browser tests on port 3100 |

For browser tests:

```sh
npx playwright install chromium
npm run build
npm run e2e
```

## 📂 Project structure

```text
src/
  app/              Pages and API route handlers (src/app/api)
  components/       UI components
  lib/domain/       Business rules, permissions, privacy, case state machine
  lib/mediator/     AI providers: gemini.ts, claude.ts, local.ts + prompts
prisma/
  schema.prisma     Data model
  seed.ts           Synthetic demo data
scripts/check-ai.ts AI provider connection test
tests/, e2e/        Vitest and Playwright tests
```

## ⚙️ How it works

- **Notice integrity:** Approval is tied to the SHA-256 hash of the exact draft. Any edit or regeneration needs fresh approval. Sending uses an idempotency key to prevent duplicates.
- **Deterministic escalation:** Reports about the same household and category within two hours count as one incident. Only distinct, undisputed, unresolved incidents count toward the 3-in-30-days rule. A reply reminder is due after 72 hours, and open cases are flagged after 7 days.
- **Privacy controls:** Server-side access checks by person, household and community. Outgoing text, including AI-drafted text, is screened for identifying details. Identity reveals require a recorded reason.

## ⚠️ Prototype limitations

- Demo sign-in has no passwords or identity verification. **Do not deploy this as a live resident or emergency system.**
- Keyword-based safety screening and the rule-based mediator can produce false positives or miss issues.
- SOS alerts depend on staffed management. There is no real dispatch integration.
- No external notifications, attachments, Bahasa Melayu UI or data-retention controls yet.
- Thresholds in `src/lib/domain/constants.ts` are demo defaults, not validated policy or legal advice.
