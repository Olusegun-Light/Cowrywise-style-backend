import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration, httpRequestTotal } from "../Utils/metrics";

const UNMATCHED_ROUTE_LABEL = "<unmatched>";

const buildRouteLabel = (req: Request): string => {
  if (!req.route) {
    return UNMATCHED_ROUTE_LABEL;
  }

  const routePath = req.route.path;
  if (typeof routePath !== "string") {
    return "<complex>";
  }

  const baseUrl = req.metricsBaseUrl ?? req.baseUrl;
  return routePath === "/" ? baseUrl || "/" : `${baseUrl}${routePath}`;
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
