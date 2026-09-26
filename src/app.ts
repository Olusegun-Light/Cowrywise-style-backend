import "./instrument";
import "./Utils/bigintJson";
import "express-async-errors";
import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import * as Sentry from "@sentry/node";
import { env } from "./Config/env";
import routes from "./Routes";
import { errorHandler } from "./Middlewares/errorHandler";
import { successResponse } from "./Utils/responseHandler";
import prisma from "./Config/db";
import helmet from "helmet";
import { AppError } from "./Utils/AppError";
import { generalRateLimiter } from "./Middlewares/rateLimit";

import swaggerUi from "swagger-ui-express";
import { SwaggerTheme, SwaggerThemeNameEnum } from "swagger-themes";
import openApiDocument from "./Utils/swagger";

import { httpLogger } from "./Middlewares/httpLogger";
import { httpMetrics } from "./Middlewares/metrics";
import { register } from "./Utils/metrics";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError("Not allowed by CORS", 403));
    },
  }),
);

app.use(generalRateLimiter);

const swaggerTheme = new SwaggerTheme();
const swaggerOptions = {
  explorer: true,
  customCss: swaggerTheme.getBuffer(SwaggerThemeNameEnum.DARK_MONOKAI),
};

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV !== "test") {
  app.use(httpLogger);
}

app.use(httpMetrics);

app.get("/", (_req, res) => {
  successResponse({ res, message: "Welcome to Cowrywise API. Use /api/v1" });
});

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  successResponse({ res, message: "ok", data: { db: "connected" } });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use(
  "/api/v1/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, swaggerOptions),
);

app.use("/api/v1", routes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "That URL does not exist on this server",
  });
});

Sentry.setupExpressErrorHandler(app, {
  shouldHandleError: (err) => {
    return !(err instanceof AppError) && !(err instanceof ZodError);
  },
});

app.use(errorHandler);

export default app;
