# NordStone

A Next.js App Router application for preparing AI proposals from a job brief and a saved company profile. Built with React, TypeScript, Zod and Lucide icons.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8765 and choose **Preview workspace** for manual entry, or **Continue with Upwork** to connect through Upwork MCP. Submission remains manual.

For a production build:

```sh
npm run build
npm start
```

Both development and production bind to 127.0.0.1:8765. Stop the current process before switching modes.

## Configuration

Copy `.env.example` to `.env` and configure the selected provider locally. Existing `.env` files continue to work.

| Variable           | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `AI_PROVIDER`      | `gemini` or `openai`                                                        |
| `GEMINI_API_KEY`   | Gemini server API key                                                       |
| `GEMINI_MODEL`     | Defaults to `gemini-2.5-flash`                                              |
| `OPENAI_API_KEY`   | Optional OpenAI alternative                                                 |
| `OPENAI_MODEL`     | Defaults to `gpt-5.4-mini`                                                  |
| `SESSION_SECRET`   | Stable random secret for signed sessions and encrypted Upwork token cookies |
| `APP_ORIGIN`       | Defaults to `http://127.0.0.1:8765`; used to validate API request origins   |
| `PROFILE_DATA_DIR` | Optional directory for the persistent company profile; defaults to `data/`  |

All provider calls execute in server-only modules. Keys are never sent to the browser. `.env` and `data/` are excluded from Git. API usage and provider retention rules apply. Upwork passwords are never collected; authorization tokens are encrypted in HttpOnly cookies.

## Application structure

```text
src/
  app/
    page.tsx                 Login / preview entry
    (workspace)/
      layout.tsx             Session guard and shared workspace
      dashboard/page.tsx
      proposals/page.tsx
      about/page.tsx
      activity/page.tsx
      settings/page.tsx
    api/
      session/route.ts        Signed HttpOnly preview session
      status/route.ts         Session-protected connection status
      profile/route.ts        Read/save company About us
      draft/route.ts          Validated AI drafting
  components/
    ui/                      Buttons, icons, headers, dialogs
    workspace/               Shell, context, dashboard and settings
    proposals/               Intake, generation, editing, review and copy
    profile/                 About us editor
  lib/
    schemas.ts               Shared request/result validation
    client/                  Typed task reducer and API client
    server/
      session.ts             Session verification and CSRF/origin protection
      profile-store.ts       Atomic, versioned company profile persistence
      ai/                    Prompt assembly, provider adapters and validation
tests/                       Domain, persistence, provider and session tests
```

## Workflow

1. Save company details and real background on **About us**.
2. Enter a job link, title and brief. Screening questions are optional.
3. Choose **Generate proposal**. AI uses only relevant parts of the saved profile.
4. Edit and review the proposal and each screening answer. Unknown facts remain visible.
5. Approve the exact version and copy it. Submit in Upwork yourself.
6. Clear the task or explicitly record a manual submission. Copying alone never records a submission.

Changing a job, draft, answer or saved company profile invalidates approval. Job/profile changes cancel the client request; outdated responses are discarded. The server also checks profile versions before and after generation.

## Data and sessions

About us is stored in `data/company-profile.json`. The prior JSON format is preserved. Atomic writes and optimistic version checks prevent one save from silently overwriting another. No sample company experience is bundled.

Jobs, drafts, answers, profile snapshots and activity counts stay in the React workspace's memory. Navigation between workspace pages preserves them; refresh, clear and sign-out remove them. The client clears active work and signs out after 60 minutes of inactivity. Company information persists separately.

Preview sessions use signed HttpOnly cookies and protect API routes. A preview cookie grants local workspace access only; it is not Upwork authentication. Sessions have a 12-hour maximum lifetime in addition to client idle clearing. This is a single-operator local application, not a public multi-user service.

AI requests send the supplied title, brief, screening questions and saved company profile to the configured provider. The reference URL is neither fetched nor sent. OpenAI requests use `store:false`; Gemini uses native `generateContent`. The app does not log or persist job content. Clipboard copies and provider retention are outside the app's control.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests use temporary profile files and synthetic fixtures. They verify persistence, stale-write handling, canonical AI context, response validation, approval invalidation, task clearing and session integrity. Browser checks cover the real page and API integration. Live AI checks, when performed, use test briefs only.

## Upwork connection

The sign-in button starts Upwork MCP's OAuth 2.1 authorization-code flow. It
uses dynamic client registration and PKCE, so no Upwork client ID, client secret
or tenant ID needs to be created or stored. Set `APP_ORIGIN` to the exact public
HTTPS origin of the deployed app and keep a stable private `SESSION_SECRET`.

On Vercel, the exact platform-provided deployment, branch and production domains
are also accepted when `VERCEL=1`. Arbitrary Host and cross-origin writes remain
rejected. Environment changes require redeployment.

After connecting, paste a current Upwork job-details URL and choose **Fetch job
details**. Nordstone uses the MCP `find_jobs` read operation to supply the title
and brief; it does not invent details if access fails. Current numeric `~02` links are supported. Legacy
`~01` links require manual entry. Screening questions and client restrictions
must be checked separately. Direct submission is not implemented.

Tokens live only in encrypted, HttpOnly cookies bound to the signed session.
They are never passed to React props, browser JavaScript or local data files.
Expired authorization requires reconnection; signing out removes the cookies.
The About us profile still uses a local JSON file: durable hosted persistence
must be configured before using profile saves on Vercel serverless instances.

Without an Upwork connection, Preview workspace and manual job entry still work.
OAuth and job import tests use mocked provider responses only.
