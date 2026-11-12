import "server-only";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../errors";
export function budgetWait(history: number[], now: number): number {
  let wait = 0;
  for (const [duration, limit] of [
    [60000, 12],
    [3600000, 120],
    [86400000, 600],
  ]) {
    const recent = history
      .filter((t) => t > now - duration)
      .sort((a, b) => a - b);
    if (recent.length >= limit)
      wait = Math.max(
        wait,
        Math.ceil((recent[recent.length - limit] + duration - now) / 1000),
      );
  }
  return wait;
}
const globals = globalThis as typeof globalThis & {
  nordstoneReadQueue?: Promise<unknown>;
};
/** Conservative workspace-wide budget; includes job searches and full-detail reads. */
export function reserveRead() {
  const operation = (globals.nordstoneReadQueue ?? Promise.resolve()).then(
    async () => {
      const file = path.join(
        process.env.PROFILE_DATA_DIR ?? path.join(process.cwd(), "data"),
        "upwork-read-budget.json",
      );
      let history: number[] = [];
      try {
        const value = JSON.parse(await readFile(file, "utf8"));
        if (!Array.isArray(value) || !value.every((t) => typeof t === "number"))
          throw new Error();
        history = value;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          throw new AppError(
            503,
            "Search usage could not be verified. Try again after checking the workspace data.",
          );
      }
      const now = Date.now();
      history = history.filter((t) => t > now - 86400000);
      const wait = budgetWait(history, now);
      if (wait)
        throw new AppError(
          429,
          `Upwork search protection: wait ${wait} seconds before another search or detail request.`,
        );
      history.push(now);
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = file + "." + randomUUID() + ".tmp";
      await writeFile(temporary, JSON.stringify(history), { mode: 0o600 });
      await rename(temporary, file);
    },
  );
  globals.nordstoneReadQueue = operation.catch(() => undefined);
  return operation;
}
