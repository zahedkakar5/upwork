# NordStone development

This is a Next.js App Router application using React and strict TypeScript.

- Keep pages under `src/app`, reusable UI under `src/components`, domain state under `src/lib/client`, and private provider/persistence code under `src/lib/server`.
- Server code that reads keys or local files must import `server-only`. Never expose API keys, session secrets or provider request headers through client props or logs.
- `.env` and `data/` are intentionally ignored. Preserve existing API configuration and the saved company profile during changes.
- Persist company About us information only. Active job briefs, drafts, screening answers and counts remain in memory.
- Every AI request must load the saved company profile, validate its version, validate structured output and reject a result if the profile changed in flight.
- Edits invalidate proposal approval. Copying does not count as submission.
- There are no sample case studies or invented company experience.
- Upwork OAuth login and job import require approved API credentials. Direct submission is not implemented. Do not label preview mode as authenticated Upwork access or fake a successful integration.
- Use the existing Gemini/OpenAI adapters; do not add unrelated integrations.
- Validate meaningful changes with `npm run typecheck`, `npm test` and `npm run build`. Use the in-app browser for relevant UI checks. Never put real client details into fixtures or screenshots.
