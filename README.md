# NordStone

A Next.js App Router application for preparing AI proposals from a job brief and a saved company profile. Built with React, TypeScript, Zod and Lucide icons.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8765 and choose **Preview workspace** for manual entry, or **Continue with Upwork** to connect through Upwork MCP. Manual submission remains available; the reviewed MCP submission flow is in development.

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

Hosted login is not currently verified. Upwork returns `invalid_redirect_uri`
when registering this production callback. Although Upwork's metadata advertises
Client ID Metadata Document support, a live sign-in using a URL-based client ID
returned "Client not found or disabled" after authentication. That failed
alternative has been removed. Dynamic registration with PKCE remains in place;
do not bypass redirect validation or copy localhost OAuth credentials to production.

On Vercel, the exact platform-provided deployment, branch and production domains
are also accepted when `VERCEL=1`. Arbitrary Host and cross-origin writes remain
rejected. Environment changes require redeployment.

After connecting, paste a current Upwork job-details URL and choose **Fetch job
details**. Nordstone uses the MCP `find_jobs` read operation to supply the title
and brief; it does not invent details if access fails. Current numeric `~02` links are supported. Legacy
`~01` links require manual entry. Screening questions and client restrictions
must be checked separately. The reviewed MCP submission flow is implemented behind live-schema checks, with account authorization and end-to-end verification still pending.

Tokens live only in encrypted, HttpOnly cookies bound to the signed session.
They are never passed to React props, browser JavaScript or local data files.
Expired authorization requires reconnection; signing out removes the cookies.
The About us profile still uses a local JSON file: durable hosted persistence
must be configured before using profile saves on Vercel serverless instances.

Without an Upwork connection, Preview workspace and manual job entry still work.
OAuth and job import tests use mocked provider responses only.

## Reviewed MCP submission (development)

The approved-proposal screen includes a Review & submit panel. It loads accessible accounts, lets the operator select one and enter an exact USD bid, and reads the selected job and Connects wallet. Preparing an upstream preview requires explicit approval; submitting requires a separate confirmation of the returned preview and Connects cost. No automatic boosting or Connects purchases are supported.

The server binds each review to its session, profile version and exact approved content and terms. Reviews expire after five minutes. One-way account/job fingerprints in `data/submission-receipts/` prevent repeated confirmation attempts across restarts; proposal text is not stored in those receipts. Uncertain results require checking Upwork directly, rather than automatic retry. Do not delete a receipt to retry without first reconciling the application on Upwork.

**Live verification is pending:** Upwork authorization currently returns “User is not eligible to authorize.” The implementation validates every request against the authenticated MCP tool schema and refuses unknown fields. Initial submission mapping supports applications without screening questions or attachments. Jobs with screening questions remain manual until their upstream question identifiers and answer format are verified. Missing costs, balance or explicit eligibility also block confirmation. The confirmation path is tested with synthetic data; no real proposal has been submitted or Connects spent during development.

## Ron’s discovery brief — 12 November implementation

Suggested jobs now uses user-initiated, newest-first official MCP search, with any-category coverage by default so miscategorized postings remain eligible. Specialties include mobile, web/full stack/front end, design/prototyping, AI/chatbots, ecommerce and desktop. Optional skill terms broaden the query (OR); they do not assert company credentials. Optional category, job type, experience and hourly duration filters are forwarded to MCP. Scope is filtered only when a result explicitly supplies it; missing scope is excluded when a scope filter is selected. Location and talent-type preferences are not filters. Explicit no-AI/no-agency wording remains a review restriction; automated detection is conservative and requires human review.

Posting ages are checked locally against returned timestamps. Jobs outside the selected window, with missing/invalid timestamps, already applied flags, or without a product-development relevance signal are excluded. Each page contains at most 10 upstream results; Load more follows only a returned cursor. A broad query is not exhaustive category/skill permutation coverage. Scoring is a transparent heuristic using relevance, matching terms, portfolio overlap, freshness, verified payment, hire rate, spend and jobs posted; missing fields earn no client-quality points.

Opening a suggestion re-fetches full job details before replacing active work. Screening question strings and question/text objects are imported in order; multiline question text is normalized into one entry. Draft output requires a separate answer per supplied question, preserves order, and flags missing facts. Quoted client-required opening phrases are placed first in generated and copied text. Complex or unquoted instructions still need manual review.

Per Ron’s revised workflow, the submission UI is removed and the application POST endpoint rejects submissions, including confirmation calls. Human review and manual submission remain required. No bot simulates presence. No availability claim is shown without confirmed availability.

Safety review: official MCP access only, no website scraping or background polling. Persistent workspace-wide budgets conservatively cap searches/detail reads at 12/minute, 120/hour and 600/rolling day, in addition to the 15-second search cooldown. Other clients using the same Upwork account still consume its upstream limits. Guidance checked: https://support.upwork.com/hc/en-us/articles/56577997707923-Rate-limits-for-Upwork-MCP and https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly . This is an implementation review, not Upwork certification.

Remaining launch checks: connect an eligible account, verify current tool schemas and actual result/question shapes, inspect client metrics and filters on representative live jobs, and measure posting-to-review latency. The eight-minute target is not guaranteed: a permitted event/notification ingestion mechanism has not been connected, and this app does not poll. Profile edits and availability/video changes remain Jags’s task.
