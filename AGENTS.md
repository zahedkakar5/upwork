# NordStone development

This is a Next.js App Router application using React and strict TypeScript.

- Keep pages under `src/app`, reusable UI under `src/components`, domain state under `src/lib/client`, and private provider/persistence code under `src/lib/server`.
- Server code that reads keys or local files must import `server-only`. Never expose API keys, session secrets or provider request headers through client props or logs.
- `.env` and `data/` are intentionally ignored. Preserve existing API configuration and the saved company profile during changes.
- Persist company About us information only. Active job briefs, drafts, screening answers and counts remain in memory.
- Every AI request must load the saved company profile, validate its version, validate structured output and reject a result if the profile changed in flight.
- Edits invalidate proposal approval. Copying does not count as submission.
- There are no sample case studies or invented company experience.
- Upwork OAuth login and job import use Upwork MCP's OAuth 2.1 dynamic client registration and PKCE. Never add a static client secret or expose an MCP access token. Ron’s latest brief requires human review and manual submission on Upwork. Keep in-app submission disabled. Never auto-retry an uncertain confirmation or spend on boosts or Connects purchases. Unknown tool schemas and screening-question mappings must fail closed. Do not label preview mode as authenticated Upwork access or fake a successful integration.
- Use the existing Gemini/OpenAI adapters; do not add unrelated integrations.
- Validate meaningful changes with `npm run typecheck`, `npm test` and `npm run build`. Use the in-app browser for relevant UI checks. Never put real client details into fixtures or screenshots.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
