import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { logger } from "../Utils/logger";

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.headers["x-request-id"];
    const resolvedId = Array.isArray(existingId) ? existingId[0] : existingId;
    if (resolvedId) {
      return resolvedId;
    }

    const id = randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
