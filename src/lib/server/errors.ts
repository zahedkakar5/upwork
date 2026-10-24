import "server-only";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
