export class AppError extends Error {
  public readonly statusCode: number;
  public readonly data?: unknown;
  public readonly isOperational = true;

  constructor(message: string, statusCode = 400, data?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
