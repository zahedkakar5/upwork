import "server-only";
import { AppError } from "../errors";
import { fetchMcpJobDetails } from "./mcp";

export function jobIdFromUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError(400, "Paste a valid Upwork job URL."); }
  if (url.protocol !== "https:" || !["www.upwork.com", "upwork.com"].includes(url.hostname) || url.port || url.username || url.password)
    throw new AppError(400, "Use an https://www.upwork.com job link.");
  if (!url.pathname.includes("~02")) throw new AppError(400, "Use a current Upwork job-details link containing ~02. Older ~01 links need manual entry.");
  return value;
}
export async function fetchJobDetails(url: string, token: string) {
  jobIdFromUrl(url);
  return fetchMcpJobDetails(url, token);
}
