import "server-only";
import { z } from "zod";
import { AppError } from "../errors";
const eligibleAccount = z.object({
  org_uid: z
    .union([z.string().min(1), z.number().int().safe().positive()])
    .transform(String),
  role: z.enum(["TALENT", "FL_AGENCY"]),
});
export function parseWorkAccounts(value: unknown) {
  let current = value;
  for (let depth = 0; depth < 5; depth++) {
    if (Array.isArray(current))
      return current.flatMap((item) => {
        const parsed = eligibleAccount.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      });
    if (!current || typeof current !== "object") break;
    const r = current as Record<string, unknown>;
    if (Array.isArray(r.accounts)) {
      current = r.accounts;
      continue;
    }
    if (r.data !== undefined) {
      current = r.data;
      continue;
    }
    if (r.result !== undefined) {
      current = r.result;
      continue;
    }
    break;
  }
  throw new AppError(
    502,
    "Upwork returned an unrecognized account response. Reconnect Upwork and try again.",
  );
}
export function selectWorkAccount(value: unknown) {
  const accounts = parseWorkAccounts(value);
  if (accounts.length === 1) return accounts[0];
  const agency = accounts.filter((account) => account.role === "FL_AGENCY");
  if (agency.length === 1) return agency[0];
  if (!accounts.length) {
    const serialized = JSON.stringify(value);
    if (/"role"\s*:\s*"CLIENT"/.test(serialized))
      throw new AppError(
        409,
        "Upwork connected only your Client profile. Reconnect using the account that has your Freelancer or Agency profile to discover jobs.",
      );
    throw new AppError(
      502,
      "Upwork account roles could not be recognized. Reconnect Upwork and try again.",
    );
  }
  throw new AppError(
    409,
    "More than one freelancer or agency account is available. An account selection is required before searching.",
  );
}
