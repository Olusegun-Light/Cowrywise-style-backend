import { register } from "../../src/Utils/metrics";

describe("Utils/metrics registry", () => {
  it("does not register Node.js default process metrics in the test environment", async () => {
    const metricNames = (await register.getMetricsAsJSON()).map((m) => m.name);

    expect(metricNames).not.toContain("process_cpu_user_seconds_total");
    expect(metricNames).toContain("http_request_duration_seconds");
    expect(metricNames).toContain("jobs_total");
    expect(metricNames).toContain("rabbitmq_publish_total");
  });
});
