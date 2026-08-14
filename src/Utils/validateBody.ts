import type { ZodType } from "zod";
import { AppError } from "./AppError";

export const validateBody = <T>(schema: ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError("Validation failed", 422, errors);
  }

  return result.data;
};
