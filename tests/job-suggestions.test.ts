import { describe, it, expect } from "vitest";
import {
  normalizeSuggestedJobs,
  matchingProjects,
  projectSearches,
} from "../src/lib/job-suggestions";
describe("suggested jobs", () => {
  it("reads nested jobs, removes untrusted wrappers and deduplicates links", () => {
    const job = {
      url: "https://www.upwork.com/jobs/~02123456789",
      content: {
        title: "Fitness application",
        description:
          "<untrusted_participant_content>Meal planning</untrusted_participant_content>",
      },
    };
    expect(normalizeSuggestedJobs({ data: { jobs: [job, job] } })).toEqual([
      { url: job.url, title: "Fitness application", summary: "Meal planning" },
    ]);
  });
  it("rejects unsafe links and incomplete jobs", () => {
    expect(
      normalizeSuggestedJobs([
        {
          title: "A",
          description: "B",
          url: "https://upwork.com.evil.test/jobs/123",
        },
        { title: "A", url: "https://www.upwork.com/jobs/123" },
        { title: "A", description: "B", url: "javascript:alert(1)" },
      ]),
    ).toEqual([]);
  });
  it("maps every category to documented projects", () => {
    for (const search of projectSearches)
      expect(matchingProjects(search.category).length).toBeGreaterThan(0);
    expect(
      projectSearches.flatMap((s) => matchingProjects(s.category)),
    ).toHaveLength(15);
  });
});
