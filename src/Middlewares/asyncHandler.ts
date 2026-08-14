import type { Request, Response, NextFunction, RequestHandler } from "express";
import { errorResponse } from "../Utils/responseHandler";

const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const asyncTryCatch = async <T>(
  promise: Promise<T>,
  res: Response,
): Promise<T | void> => {
  try {
    return await promise;
  } catch (err) {
    errorResponse({ res, message: "error", data: err });
  }
};

export default asyncHandler;
