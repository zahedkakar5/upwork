import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  profileFieldsSchema,
  type CompanyProfile,
  type ProfileFields,
} from "../schemas";
import { AppError } from "./errors";

export interface ProfileStore {
  load(): Promise<CompanyProfile>;
  save(fields: ProfileFields, expectedVersion: string): Promise<CompanyProfile>;
}
export function normalizeProfile(value: unknown): CompanyProfile {
  const fields = profileFieldsSchema.parse(value);
  return {
    ...fields,
    version: createHash("sha256").update(JSON.stringify(fields)).digest("hex"),
  };
}
export function createProfileStore(file: string): ProfileStore {
  let pendingWrite: Promise<unknown> = Promise.resolve();
  const load = async (): Promise<CompanyProfile> => {
    try {
      return normalizeProfile(JSON.parse(await readFile(file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return normalizeProfile({
          companyName: "NordStone",
          memberName: "Jags",
          about: "",
        });
      throw new AppError(
        500,
        "About us could not be read. The saved file has not been changed.",
      );
    }
  };
  return {
    load,
    save(fields, expectedVersion) {
      const write = pendingWrite.then(async () => {
        const profile = normalizeProfile(fields);
        if ((await load()).version !== expectedVersion)
          throw new AppError(409, "About us changed. Refresh before saving.");
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
        try {
          await writeFile(temporary, `${JSON.stringify(profile, null, 2)}\n`, {
            mode: 0o600,
          });
          await rename(temporary, file);
        } finally {
          await rm(temporary, { force: true });
        }
        return profile;
      });
      pendingWrite = write.catch(() => undefined);
      return write;
    },
  };
}
const state = globalThis as typeof globalThis & {
  nordstoneProfileStore?: ProfileStore;
};
export const profileStore = (state.nordstoneProfileStore ??= createProfileStore(
  path.join(
    process.env.PROFILE_DATA_DIR ?? path.join(process.cwd(), "data"),
    "company-profile.json",
  ),
));
