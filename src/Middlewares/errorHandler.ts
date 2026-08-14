import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../Utils/AppError";
import { errorResponse } from "../Utils/responseHandler";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    errorResponse({
      res,
      statusCode: err.statusCode,
      message: err.message,
      data: err.data,
    });
    return;
  }

  if (err instanceof ZodError) {
    errorResponse({
      res,
      statusCode: 422,
      message: "Validation failed",
      data: err.issues,
    });
    return;
  }

  // Unexpected/programming error — log full detail, never leak internals to the client
  console.error("Unhandled error:", err);
  errorResponse({
    res,
    statusCode: 500,
    message: "An unexpected error occurred",
  });
};
