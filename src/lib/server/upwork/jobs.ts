import "server-only";
import { z } from "zod";
import { AppError } from "../errors";

export function jobIdFromUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "Paste a valid Upwork job URL.");
  }
  if (
    url.protocol !== "https:" ||
    !["www.upwork.com", "upwork.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new AppError(400, "Use an https://www.upwork.com job link.");
  const match = url.pathname.match(
    /(?:\/jobs\/[^/]*|\/freelance-jobs\/apply\/[^/]*|\/nx\/search\/jobs\/details\/)~02(\d{16,20})(?:\/|$)/,
  );
  if (!match)
    throw new AppError(
      400,
      "Use a current Upwork job-details link containing ~02 and its numeric job ID. Older ~01 links need manual entry.",
    );
  return match[1]!;
}
const detailsSchema = z.object({
  data: z.object({
    marketplaceJobPosting: z
      .object({
        content: z.object({
          title: z.string().trim().min(1).max(20_000),
          description: z.string().trim().min(1).max(20_000),
        }),
      })
      .nullable(),
  }),
});
export async function fetchJobDetails(url: string, token: string) {
  const id = jobIdFromUrl(url);
  let response: Response;
  try {
    response = await fetch("https://api.upwork.com/graphql", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(process.env.UPWORK_TENANT_ID
          ? { "X-Upwork-API-TenantId": process.env.UPWORK_TENANT_ID }
          : {}),
      },
      body: JSON.stringify({
        query:
          "query NordStoneJob($id: ID!) { marketplaceJobPosting(id: $id) { content { title description } } }",
        variables: { id },
      }),
    });
  } catch {
    throw new AppError(
      502,
      "Upwork did not respond. Try again or enter the job manually.",
    );
  }
  if (response.status === 401)
    throw new AppError(
      401,
      "Your Upwork authorization expired. Connect Upwork again.",
    );
  if (response.status === 403)
    throw new AppError(
      403,
      "Your Upwork API app needs Read marketplace Job Postings permission.",
    );
  if (!response.ok)
    throw new AppError(
      502,
      "Upwork could not retrieve this job. You can enter its details manually.",
    );
  const payload: unknown = await response.json();
  if (typeof payload === "object" && payload && "errors" in payload)
    throw new AppError(
      502,
      "Upwork could not provide this job. Check your API permissions and job availability.",
    );
  const parsed = detailsSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.data.marketplaceJobPosting)
    throw new AppError(
      404,
      "Job details are unavailable. The job may be private, closed or inaccessible to this account.",
    );
  const content = parsed.data.data.marketplaceJobPosting.content;
  return { title: content.title, summary: content.description };
}
