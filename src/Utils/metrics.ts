import client from "prom-client";
import { env } from "../Config/env";

export const register = new client.Registry();

if (env.NODE_ENV !== "test") {
  client.collectDefaultMetrics({ register });
}

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const jobDuration = new client.Histogram({
  name: "job_duration_seconds",
  help: "Background job duration in seconds",
  labelNames: ["job_name", "status"],
  registers: [register],
});

export const jobTotal = new client.Counter({
  name: "jobs_total",
  help: "Total background job runs",
  labelNames: ["job_name", "status"],
  registers: [register],
});

export const rabbitmqPublishTotal = new client.Counter({
  name: "rabbitmq_publish_total",
  help: "Total RabbitMQ publish attempts",
  labelNames: ["routing_key", "status"],
  registers: [register],
});

export const rabbitmqConsumeDuration = new client.Histogram({
  name: "rabbitmq_consume_duration_seconds",
  help: "RabbitMQ consumer processing duration in seconds",
  labelNames: ["routing_key", "status"],
  registers: [register],
});

export const withJobMetrics = <T>(
  jobName: string,
  fn: () => Promise<T>,
): (() => Promise<T>) => {
  return async () => {
    const start = process.hrtime.bigint();
    try {
      const result = await fn();
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      jobDuration.observe(
        { job_name: jobName, status: "success" },
        durationSeconds,
      );
      jobTotal.inc({ job_name: jobName, status: "success" });
      return result;
    } catch (err) {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      jobDuration.observe(
        { job_name: jobName, status: "failure" },
        durationSeconds,
      );
      jobTotal.inc({ job_name: jobName, status: "failure" });
      throw err;
    }
  };
};
