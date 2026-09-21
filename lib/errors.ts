export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "AppError"; this.status = status; }
}
export function publicError(error: unknown) {
  if (error instanceof AppError) return error;
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return new AppError("We couldn’t finish that request. Your input is safe—please try again in a moment.", 503);
}
export function errorResponse(error: unknown) { const e = publicError(error); return Response.json({ error: e.message }, { status: e.status, headers: { "Cache-Control": "no-store" } }); }
