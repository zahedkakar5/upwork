import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProfileStore } from "../src/lib/server/profile-store";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "nordstone-next-profile-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
describe("company profile persistence", () => {
  it("starts with an empty company profile and no invented experience", async () => {
    const profile = await createProfileStore(
      path.join(directory, "profile.json"),
    ).load();
    expect(profile).toMatchObject({
      companyName: "NordStone",
      memberName: "Jags",
      about: "",
    });
    expect(profile.version).toMatch(/^[a-f0-9]{64}$/);
  });
  it("preserves the existing JSON format and only persists company fields", async () => {
    const file = path.join(directory, "company-profile.json"),
      store = createProfileStore(file),
      initial = await store.load();
    const saved = await store.save(
      {
        companyName: "NordStone",
        memberName: "Jags",
        about: "We build accessible storefronts.",
        summary: "temporary-job-canary",
      } as Parameters<typeof store.save>[0],
      initial.version,
    );
    expect(await createProfileStore(file).load()).toEqual(saved);
    expect(await readFile(file, "utf8")).not.toContain("temporary-job-canary");
  });
  it("serializes competing saves and rejects the stale one", async () => {
    const store = createProfileStore(path.join(directory, "profile.json")),
      initial = await store.load();
    const results = await Promise.allSettled([
      store.save({ ...initial, about: "First update" }, initial.version),
      store.save({ ...initial, about: "Competing update" }, initial.version),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect((await store.load()).about).toBe("First update");
  });
  it("leaves invalid saved content intact instead of overwriting it", async () => {
    const file = path.join(directory, "profile.json");
    await writeFile(file, "invalid");
    await expect(createProfileStore(file).load()).rejects.toMatchObject({
      status: 500,
    });
    expect(await readFile(file, "utf8")).toBe("invalid");
  });
});
