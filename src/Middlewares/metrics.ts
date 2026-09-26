import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration, httpRequestTotal } from "../Utils/metrics";

export const httpMetrics = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestTotal.inc(labels);
  });

  next();
};
