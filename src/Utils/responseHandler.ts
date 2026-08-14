import type { Response } from "express";

interface MessageResponseParams<T = unknown> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
}

export const successResponse = <T>({
  res,
  statusCode = 200,
  message = "success",
  data,
}: MessageResponseParams<T>) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = <T>({
  res,
  statusCode = 400,
  message = "failure",
  data,
}: MessageResponseParams<T>) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};
