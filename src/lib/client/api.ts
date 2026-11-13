import { companionPaired, companionRequest } from "./companion";
export class ClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ClientError";
  }
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const operation =
    path === "/api/upwork/suggestions"
      ? "suggestions"
      : path === "/api/upwork/job"
        ? "job"
        : null;
  const response =
    operation && companionPaired()
      ? await companionRequest(operation, options)
      : await fetch(path, {
          ...options,
          cache: "no-store",
          headers: { "Content-Type": "application/json", ...options.headers },
        });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Request failed. Please try again.";
    throw new ClientError(response.status, message);
  }
  return result as T;
}
