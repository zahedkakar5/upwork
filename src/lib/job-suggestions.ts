import { projects } from "./projects";
export const projectSearches = [
  {
    category: "Content & sports",
    query: '"fantasy sports" OR "content platform" OR "video streaming"',
  },
  {
    category: "Fitness & wellness",
    query: '"fitness app" OR "meal planning" OR "health tracking"',
  },
  {
    category: "Fintech & commerce",
    query: '"fintech app" OR Shopify OR "payment app"',
  },
  {
    category: "Platforms & services",
    query: '"event platform" OR "education app" OR "recruitment platform"',
  },
  { category: "Document services", query: "notary OR notarization" },
];
export interface SuggestedJob {
  title: string;
  url: string;
  summary: string;
}
export function normalizeSuggestedJobs(value: unknown): SuggestedJob[] {
  const found = new Map<string, SuggestedJob>();
  function visit(node: unknown, depth = 0) {
    if (depth > 8 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.slice(0, 100).forEach((x) => visit(x, depth + 1));
      return;
    }
    const r = node as Record<string, unknown>;
    const content =
      r.content && typeof r.content === "object"
        ? (r.content as Record<string, unknown>)
        : r;
    const title = content.title ?? r.title;
    const description = content.description ?? r.description ?? r.summary;
    let url = r.url ?? r.jobUrl ?? r.job_url ?? r.ciphertext;
    if (typeof url === "string" && /^~02\d+$/.test(url))
      url = `https://www.upwork.com/jobs/${url}`;
    if (
      typeof title === "string" &&
      typeof description === "string" &&
      typeof url === "string"
    ) {
      try {
        const u = new URL(url);
        if (
          u.protocol === "https:" &&
          ["www.upwork.com", "upwork.com"].includes(u.hostname) &&
          !u.username &&
          !u.password &&
          !u.port &&
          u.pathname.includes("/jobs/") &&
          title.trim() &&
          description.trim()
        )
          found.set(u.href, {
            title: title.trim().slice(0, 20000),
            url: u.href,
            summary: description
              .replace(
                /^<untrusted_participant_content>\s*([\s\S]*?)\s*<\/untrusted_participant_content>$/,
                "$1",
              )
              .trim()
              .slice(0, 20000),
          });
      } catch {
        /* Discard invalid links. */
      }
    }
    Object.values(r).forEach((x) => visit(x, depth + 1));
  }
  visit(value);
  return [...found.values()].slice(0, 20);
}
export function matchingProjects(category: string) {
  return projects.filter((p) => p.category === category);
}
