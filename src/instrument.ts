import * as Sentry from "@sentry/node";
import { env } from "./Config/env";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
});
