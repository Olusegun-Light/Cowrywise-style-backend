import "./Utils/bigintJson";
import "express-async-errors";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./Config/env";
import routes from "./Routes";
import { errorHandler } from "./Middlewares/errorHandler";
import { successResponse } from "./Utils/responseHandler";
import prisma from "./Config/db";
import { startRedisClient } from "./Config/redis";
import { startCronService } from "./Jobs";

import swaggerUi from "swagger-ui-express";
import { SwaggerTheme, SwaggerThemeNameEnum } from "swagger-themes";
import openApiDocument from "./Utils/swagger";

const app = express();

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
app.use(cors());
if (env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  successResponse({ res, message: "Welcome to Cowrywise API. Use /api/v1" });
});

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  successResponse({ res, message: "ok", data: { db: "connected" } });
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

app.use(errorHandler);

const start = async () => {
  await startRedisClient();
  await startCronService();

  app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
  });
};

start();
