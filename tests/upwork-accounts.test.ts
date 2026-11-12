import { it, expect } from "vitest";
import {
  selectWorkAccount,
  parseWorkAccounts,
} from "../src/lib/server/upwork/accounts";
it("ignores client accounts when selecting a freelancer account", () => {
  expect(
    selectWorkAccount({
      accounts: [
        { org_uid: "client", role: "CLIENT" },
        { org_uid: "talent", role: "TALENT" },
      ],
    }),
  ).toEqual({ org_uid: "talent", role: "TALENT" });
});
it("reads wrapped responses and accepts safe numeric org identifiers", () => {
  expect(
    selectWorkAccount({
      data: { accounts: [{ org_uid: 123, role: "FL_AGENCY" }] },
    }),
  ).toEqual({ org_uid: "123", role: "FL_AGENCY" });
});
it("does not mistake client-only, malformed or multiple talent accounts for an eligible selection", () => {
  expect(() =>
    selectWorkAccount({ accounts: [{ org_uid: "client", role: "CLIENT" }] }),
  ).toThrow("Client profile");
  expect(() => parseWorkAccounts({ error: "restricted" })).toThrow(
    "unrecognized",
  );
  expect(() =>
    selectWorkAccount([
      { org_uid: "a", role: "TALENT" },
      { org_uid: "b", role: "TALENT" },
    ]),
  ).toThrow("selection");
});
