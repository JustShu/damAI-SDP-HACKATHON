# DAMAI · Neighbours at peace

## 🚀 Live Prototype

Experience **damAI — AI Neighbourhood Mediator** in action.

[![Launch Prototype](https://img.shields.io/badge/Launch_Prototype-Visit_Now-6366F1?style=for-the-badge&logo=vercel&logoColor=white)](https://dam-ai-sdp-hackathon.vercel.app/)

Or [Try the live prototype here :)](https://dam-ai-sdp-hackathon.vercel.app/)
> Explore the prototype using the built-in demo accounts.

*Jiran aman, hidup damai.*

DAMAI is a phone-first web app that helps neighbours resolve everyday concerns like noise, parking and pets through **private, AI-assisted mediation**, with **human community management** for anything serious. Residents never message each other directly. An AI mediator powered by **Google Gemini** rewrites each complaint into a neutral, privacy-safe notice, the reporter approves the exact text, and the other household replies privately. Repeated issues, safety concerns and urgent SOS alerts go to a community manager.

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
| 🧠 **Gemini AI mediator** | Uses Google Gemini to write neutral notices and reply summaries. If Gemini is unavailable, a built-in rule-based mediator takes over so the app keeps working. Claude is also supported. |
| 📱 **Mobile-first** | Phone navigation, a desktop sidebar and an installable *Add to Home Screen* web-app manifest. |

## 🛠️ Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 + SQLite · Zod · iron-session · Google Gemini API · Vitest · Playwright

---

## 🚀 Setup guide (step by step)

### Step 1: Install the prerequisites

- **Node.js 20.9 or newer** (includes npm). Download it from <https://nodejs.org> (choose the LTS version).
- **Git** (only needed for Option A in Step 2). Download it from <https://git-scm.com>.
- A **Google account** for the Gemini API key.

Check that Node.js is installed by opening a terminal (Command Prompt on Windows) and running:

```sh
node -v    # should print v20.9.0 or higher
npm -v
```

### Step 2: Download the project to your computer

Pick **one** of these options.

**Option A: with Git**

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

### Step 3: Create your `.env` file

The `.env` file holds the app's settings, including your Gemini API key. Create it by copying the example file:

```bat
:: Windows Command Prompt
copy .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```sh
# macOS / Linux
cp .env.example .env
```

> 🔐 `.env` is listed in `.gitignore`, so it is never uploaded to GitHub. **Never commit it or share your API key.**

<details>
<summary>💡 Optional: change the session secret</summary>

`SESSION_SECRET` in `.env` signs the login cookie. The example value already works for running the demo on your own computer, so you can skip this. If you share or host the app anywhere, replace it with your own random text of **at least 32 characters**. You can type any long random text, or generate one with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

</details>

### Step 4: Install dependencies

```sh
npm ci
```

This downloads the libraries the app needs (Next.js, React, Prisma and others) into a `node_modules` folder. It only needs to be done once. If `npm ci` shows an error, use `npm install` instead.

### Step 5: Create the database with demo data

```sh
npm run db:setup
```

This creates a local SQLite database at `prisma/dev.db` and fills it with synthetic residents, households and cases.

> ⚠️ Re-running `db:setup` or `db:seed` **resets** all demo data.

---

## 🤖 Step 6: Set up the Gemini AI API key

DAMAI uses Google Gemini to write the mediation notices. Google AI Studio offers a **free tier**.

### 6.1 Create an API key

1. Go to **<https://aistudio.google.com/apikey>**.
2. Sign in with your Google account and accept the terms if asked.
3. Click **Create API key**. Pick an existing Google Cloud project or let AI Studio create one for you.
4. **Copy** the key. Keep it private.

### 6.2 Add the key to `.env`

You need these two lines in `.env` (replace `paste-your-key-here` with your key):

```dotenv
MEDIATOR_PROVIDER="gemini"
GEMINI_API_KEY="paste-your-key-here"
```

`.env` already contains both lines, so you only need to edit their values. Choose **one** way to do it.

**Option A: open `.env` from Command Prompt (Windows)**

```bat
notepad .env
```

Notepad opens the file. Find the two lines, change them as shown above, then press **Ctrl + S** to save and close Notepad.

**Option B: set the values with one command**

Windows **PowerShell** (replace `paste-your-key-here` first):

```powershell
(Get-Content .env) -replace '^MEDIATOR_PROVIDER=.*','MEDIATOR_PROVIDER="gemini"' -replace '^GEMINI_API_KEY=.*','GEMINI_API_KEY="paste-your-key-here"' | Set-Content .env
```

macOS / Linux:

```sh
sed -i.bak -e 's/^MEDIATOR_PROVIDER=.*/MEDIATOR_PROVIDER="gemini"/' -e 's/^GEMINI_API_KEY=.*/GEMINI_API_KEY="paste-your-key-here"/' .env
```

**Option C: use any text editor**

Open the `.env` file in the project folder with VS Code, Notepad or another editor, edit the two lines and save.

> On Windows, File Explorer may hide the file because its name starts with a dot. Options A and B work either way.

**Optional: choose a model.** The default model is `gemini-3.1-flash-lite`. Model names change over time, so if you get a "model not found" error, check the current Flash model name in AI Studio and add this line to `.env`:

```dotenv
GEMINI_MODEL="the-current-flash-model-name"
```

### 6.3 Test the connection

```sh
npm run ai:check
```

This sends **one synthetic sample report** to Gemini and prints the result. A successful run looks like:

```text
MEDIATOR_PROVIDER = "gemini"  →  using: gemini:gemini-3.1-flash-lite
GEMINI_API_KEY    = set
...
✓ The AI works (gemini:..., 1.8s). Outcome: NOTICE
```

### Troubleshooting Gemini

| Message from `ai:check` | What to do |
| --- | --- |
| `Gemini API error 400` | The key is wrong or missing. Re-copy it into `GEMINI_API_KEY` with no extra spaces. |
| `Gemini API error 403` | This key or project can't use the model or API. Check the key in AI Studio, or try another model. |
| `Gemini API error 404` | The model name doesn't exist. Set `GEMINI_MODEL` to a current model from AI Studio. |
| `Gemini API error 429` | You've hit the free-tier rate limit. Wait a minute and retry. |
| `Gemini API error 5xx` / `AI timeout` | Temporary Google issue. Retry later. Meanwhile the app uses its built-in mediator. |
| `using: built-in` | The key wasn't picked up. Make sure you edited `.env` (not `.env.example`), saved it, and that `GEMINI_API_KEY` isn't empty. |

---

### Step 7: Start the app

```sh
npm run dev
```

Open **<http://localhost:3000>** in your browser.

> If you change `.env` while the app is running, stop it with **Ctrl + C** and run `npm run dev` again.

### Step 8: Sign in with a demo account

Demo sign-in has no passwords. Just pick an account on the sign-in screen:

| Account | Role |
| --- | --- |
| `resident39@example.test` (Daniel Lim) | Resident, House 39 |
| `resident18@example.test` (Nur Aisyah) | Resident, House 18 |
| `manager@example.test` (Farah) | Community manager |

**Try this flow:** sign in as Daniel → report a concern about House 18 → approve the Gemini-drafted notice → sign out → sign in as Nur Aisyah → reply → sign in as Farah to see the manager view. The manager screen also has a **demo clock** for jumping time forward to trigger reminders and flags, plus a **reset** button.

---

## 🔁 Using Claude instead of Gemini

DAMAI also supports Anthropic Claude. Get a key at <https://console.anthropic.com> and set in `.env`:

```dotenv
MEDIATOR_PROVIDER="claude"
ANTHROPIC_API_KEY="your-anthropic-key"
# CLAUDE_MODEL="claude-opus-5-5"
```

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
- **Privacy controls:** Server-side access checks by person, household and community. Outgoing text, including AI-drafted text, is screened for identifying details. Identity reveals require a recorded reason. The Gemini API key stays on the server and is never sent to the browser.

## ⚠️ Prototype limitations

- Demo sign-in has no passwords or identity verification. **Do not deploy this as a live resident or emergency system.**
- Keyword-based safety screening and the backup rule-based mediator can produce false positives or miss issues.
- SOS alerts depend on staffed management. There is no real dispatch integration.
- No external notifications, attachments, Bahasa Melayu UI or data-retention controls yet.
- Thresholds in `src/lib/domain/constants.ts` are demo defaults, not validated policy or legal advice.
