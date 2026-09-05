import pino from "pino";
import { env } from "../Config/env";

const isProduction = env.NODE_ENV === "production";
const level = env.LOG_LEVEL || (isProduction ? "info" : "debug");

export const logger = pino({
  level,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: ["password", "headers.authorization", "headers.cookie", "email"],
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});
