import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration, httpRequestTotal } from "../Utils/metrics";

const buildRouteLabel = (req: Request): string => {
  if (!req.route) {
    return req.path;
  }

  const routePath: string = req.route.path;
  const pathnameOnly = req.originalUrl.split("?")[0] ?? req.originalUrl;

  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/:[^/\\]+/g, "[^/]+");
  const regex = new RegExp(`${pattern}$`);
  const match = pathnameOnly.match(regex);

  if (!match) {
    return `${req.baseUrl}${routePath}`;
  }

  return pathnameOnly.slice(0, match.index) + routePath;
};

export const httpMetrics = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = buildRouteLabel(req);
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
