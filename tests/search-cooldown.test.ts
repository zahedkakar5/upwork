import { expect, it } from "vitest";
import { createSearchCooldown } from "../src/lib/server/search-cooldown";
it("blocks rapid and concurrent searches, then allows the next search", () => {
  const claim = createSearchCooldown();
  expect(claim(1000)).toBe(0);
  expect(claim(1000)).toBe(15);
  expect(claim(1501)).toBe(15);
  expect(claim(15999)).toBe(1);
  expect(claim(16000)).toBe(0);
  expect(claim(16000)).toBe(15);
});
