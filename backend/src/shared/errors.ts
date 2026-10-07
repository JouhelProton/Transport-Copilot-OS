export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (code: string, message: string) =>
  new AppError(400, code, message);
export const unauthorized = (message = "Autenticación requerida") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (
  message = "No tienes permisos para realizar esta acción",
) => new AppError(403, "FORBIDDEN", message);
export const notFound = (entity: string) =>
  new AppError(404, "NOT_FOUND", `${entity} no encontrado`);
export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
