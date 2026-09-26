import { httpMetrics } from "../../src/Middlewares/metrics";
import { httpRequestDuration, httpRequestTotal } from "../../src/Utils/metrics";

describe("httpMetrics middleware", () => {
  const makeReq = (overrides: Record<string, unknown> = {}) => ({
    method: "POST",
    path: "/api/v1/circles/abc123/contribute",
    baseUrl: "/api/v1/circles",
    metricsBaseUrl: "/api/v1/circles",
    route: { path: "/:circleId/contribute" },
    ...overrides,
  });

  const makeRes = () => {
    const listeners: Record<string, () => void> = {};
    return {
      statusCode: 201,
      on: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
      _fireFinish: () => listeners.finish?.(),
    };
  };

  it("records the matched route pattern using the eagerly-captured metricsBaseUrl", async () => {
    const observeSpy = jest.spyOn(httpRequestDuration, "observe");
    const incSpy = jest.spyOn(httpRequestTotal, "inc");
    const req = makeReq();
    const res = makeRes();

    httpMetrics(req as never, res as never, () => {});
    res._fireFinish();

    expect(incSpy).toHaveBeenCalledWith({
      method: "POST",
      route: "/api/v1/circles/:circleId/contribute",
      status_code: 201,
    });
    expect(observeSpy).toHaveBeenCalledWith(
      {
        method: "POST",
        route: "/api/v1/circles/:circleId/contribute",
        status_code: 201,
      },
      expect.any(Number),
    );

    observeSpy.mockRestore();
    incSpy.mockRestore();
  });

  it("still resolves correctly using metricsBaseUrl even if baseUrl itself was reset (simulating Express's error-unwind)", async () => {
    const incSpy = jest.spyOn(httpRequestTotal, "inc");
    const req = makeReq({ baseUrl: "" });
    const res = { ...makeRes(), statusCode: 500 };

    httpMetrics(req as never, res as never, () => {});
    res._fireFinish();

    expect(incSpy).toHaveBeenCalledWith({
      method: "POST",
      route: "/api/v1/circles/:circleId/contribute",
      status_code: 500,
    });

    incSpy.mockRestore();
  });

  it("collapses a root-route match to just the mount prefix, not a trailing slash", async () => {
    const incSpy = jest.spyOn(httpRequestTotal, "inc");
    const req = makeReq({
      route: { path: "/" },
      metricsBaseUrl: "/api/v1/circles",
    });
    const res = { ...makeRes(), statusCode: 422 };

    httpMetrics(req as never, res as never, () => {});
    res._fireFinish();

    expect(incSpy).toHaveBeenCalledWith({
      method: "POST",
      route: "/api/v1/circles",
      status_code: 422,
    });

    incSpy.mockRestore();
  });

  it("uses a bounded placeholder, never the raw path, when no route was matched at all", async () => {
    const incSpy = jest.spyOn(httpRequestTotal, "inc");
    const req = makeReq({
      route: undefined,
      metricsBaseUrl: undefined,
      path: "/does/not/exist",
    });
    const res = { ...makeRes(), statusCode: 404 };

    httpMetrics(req as never, res as never, () => {});
    res._fireFinish();

    expect(incSpy).toHaveBeenCalledWith({
      method: "POST",
      route: "<unmatched>",
      status_code: 404,
    });

    incSpy.mockRestore();
  });
});
