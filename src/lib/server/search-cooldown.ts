import "server-only";
export function createSearchCooldown(intervalMs = 15_000) {
  let nextAllowedAt = 0;
  return (now = Date.now()): number => {
    if (now < nextAllowedAt) return Math.ceil((nextAllowedAt - now) / 1_000);
    nextAllowedAt = now + intervalMs;
    return 0;
  };
}
// This single-operator workspace shares the cooldown across tabs and sessions.
const state = globalThis as typeof globalThis & {
  nordstoneSearchCooldown?: ReturnType<typeof createSearchCooldown>;
};
export const claimSearch = state.nordstoneSearchCooldown ??= createSearchCooldown();
