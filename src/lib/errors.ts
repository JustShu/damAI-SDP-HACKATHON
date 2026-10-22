// Errors thrown by domain services; API routes map them to HTTP status codes.
// Messages are deliberately generic so they never leak household details.

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthenticated = () => new AppError(401, "Please sign in.");
export const forbidden = () => new AppError(403, "You don't have access to this.");
export const badRequest = (message: string) => new AppError(400, message);
export const conflict = (message: string) => new AppError(409, message);
