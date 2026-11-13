const origin = "http://127.0.0.1:8765";
const storageKey = "nordstone.companion.v1";
let code = "";
export const companionChanged = "nordstone-companion-changed";
export function companionPaired() {
  return Boolean(code);
}
export async function companionRequest(
  operation: string,
  options: RequestInit = {},
  pairingCode = code,
) {
  let response: Response;
  try {
    response = await fetch(`${origin}/api/companion/${operation}`, {
      method: "POST",
      body: options.body ?? "{}",
      signal: options.signal ?? AbortSignal.timeout(65_000),
      credentials: "omit",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pairingCode}`,
      },
    });
  } catch {
    if (code) disconnectCompanion();
    throw new Error(
      "Cannot reach the companion. Keep it running on this computer and allow Chrome's local network permission if prompted.",
    );
  }
  if (response.status === 401 && code) disconnectCompanion();
  return response;
}
export async function pairCompanion(value: string) {
  const candidate = value.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(candidate))
    throw new Error("Paste the pairing code shown by your local companion.");
  const response = await companionRequest("status", {}, candidate);
  const result = await response.json();
  if (!response.ok || !result.upworkConnected)
    throw new Error(
      result.error ?? "Connect Upwork in the local companion first.",
    );
  code = candidate;
  try {
    sessionStorage.setItem(storageKey, code);
  } catch {
    /* Memory pairing still works. */
  }
  window.dispatchEvent(new Event(companionChanged));
}
export async function restoreCompanion() {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) await pairCompanion(saved);
  } catch {
    disconnectCompanion();
  }
}
export function disconnectCompanion() {
  code = "";
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* No saved pairing. */
  }
  window.dispatchEvent(new Event(companionChanged));
}
