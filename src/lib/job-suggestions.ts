import { screeningFrom } from "./job-discovery";
import type { DiscoveryFilters } from "./job-discovery";
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
  skills?: string[];
  postedAt?: string;
  jobType?: string;
  experience?: string;
  duration?: string;
  scope?: string;
  questions?: string[];
  client?: {
    paymentVerified: boolean | null;
    hireRate: number | null;
    spent: number | null;
    jobsPosted: number | null;
  };
  applied?: boolean;
  score?: number;
  reasons?: string[];
  matchedProjects?: string[];
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
            skills: Array.isArray(r.skills)
              ? r.skills
                  .map((x) =>
                    typeof x === "string"
                      ? x
                      : String((x as Record<string, unknown>).name ?? ""),
                  )
                  .filter(Boolean)
              : [],
            postedAt:
              typeof (r.published_date ?? r.created_date) === "string"
                ? String(r.published_date ?? r.created_date)
                : undefined,
            jobType: typeof r.job_type === "string" ? r.job_type : undefined,
            experience:
              typeof r.experience_level === "string"
                ? r.experience_level
                : undefined,
            duration: typeof r.duration === "string" ? r.duration : undefined,
            scope: typeof r.scope === "string" ? r.scope : undefined,
            questions: screeningFrom(r.screening_questions ?? r.questions),
            applied: r.applied === true,
            client: clientSignals(r.client),
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

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^[\d,. $]+$/.test(value)) {
    const n = Number(value.replace(/[$, ]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function clientSignals(value: unknown): SuggestedJob["client"] {
  const r =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    paymentVerified:
      typeof r.payment_verified === "boolean"
        ? r.payment_verified
        : typeof r.verification_status === "string"
          ? r.verification_status.toLowerCase() === "verified"
          : null,
    hireRate: number(r.hire_rate),
    spent: number(r.total_spent),
    jobsPosted: number(r.total_posted_jobs),
  };
}
export function rankJobs(
  jobs: SuggestedJob[],
  filters: DiscoveryFilters,
  now = Date.now(),
) {
  return jobs
    .filter((j) => !j.applied)
    .filter((j) => {
      const posted = Date.parse(j.postedAt ?? "");
      return (
        Number.isFinite(posted) &&
        posted <= now + 60000 &&
        now - posted <= filters.maxAgeMinutes * 60000 &&
        (filters.scope === "all" || j.scope === filters.scope)
      );
    })
    .map((job) => {
      const text = (
        job.title +
        " " +
        job.summary +
        " " +
        job.skills?.join(" ")
      ).toLowerCase();
      const signals = [
        /\b(app|mobile|ios|android|flutter|react|website|web|shopify|ecommerce|chatbot|figma|prototype|software|desktop)\b/.test(
          text,
        ),
        /\b(develop|build|design|integrat|engineer|program|implement)/.test(
          text,
        ),
      ];
      const matched = projects.filter((p) =>
        p.description
          .toLowerCase()
          .split(/\W+/)
          .filter(
            (w) =>
              w.length > 5 &&
              ![
                "application",
                "development",
                "experience",
                "platform",
                "products",
                "supporting",
              ].includes(w),
          )
          .some((w) => text.includes(w)),
      );
      const reasons: string[] = [];
      let score = signals[0] && signals[1] ? 45 : 0;
      if (score) reasons.push("Relevant product development work");
      const skills = filters.skills.filter((s) =>
        text.includes(s.toLowerCase()),
      );
      score += Math.min(15, skills.length * 5);
      if (skills.length) reasons.push("Matching skills: " + skills.join(", "));
      if (matched.length) {
        score += 15;
        reasons.push("Related portfolio workflows");
      }
      if (job.client?.paymentVerified) {
        score += 8;
        reasons.push("Payment verified");
      }
      if ((job.client?.hireRate ?? 0) >= 50) {
        score += 5;
        reasons.push("Client hire rate ≥50%");
      }
      if ((job.client?.spent ?? 0) > 0) {
        score += 5;
        reasons.push("Previous client spend");
      }
      if ((job.client?.jobsPosted ?? 0) > 0) score += 2;
      if (now - Date.parse(job.postedAt!) <= 8 * 60000) {
        score += 5;
        reasons.push("Posted within 8 minutes");
      }
      return {
        ...job,
        score: Math.min(100, score),
        reasons,
        matchedProjects: matched.slice(0, 2).map((p) => p.name),
        relevant: signals.every(Boolean),
      };
    })
    .filter((j) => j.relevant)
    .sort(
      (a, b) =>
        Date.parse(b.postedAt!) - Date.parse(a.postedAt!) || b.score - a.score,
    );
}
