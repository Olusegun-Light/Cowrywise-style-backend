import { httpMetrics } from "../../src/Middlewares/metrics";
import { httpRequestDuration, httpRequestTotal } from "../../src/Utils/metrics";

describe("httpMetrics middleware", () => {
  const makeReq = (overrides: Record<string, unknown> = {}) => ({
    method: "POST",
    path: "/api/v1/circles/abc123/contribute",
    baseUrl: "/api/v1/circles",
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

  it("records the matched route pattern, not the raw URL, on a successful request", async () => {
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

  it("falls back to the raw path (never undefined) when no route was matched, e.g. a 404", async () => {
    const incSpy = jest.spyOn(httpRequestTotal, "inc");
    const req = makeReq({
      route: undefined,
      baseUrl: "",
      path: "/does/not/exist",
    });
    const res = { ...makeRes(), statusCode: 404 };

    httpMetrics(req as never, res as never, () => {});
    res._fireFinish();

    expect(incSpy).toHaveBeenCalledWith({
      method: "POST",
      route: "/does/not/exist",
      status_code: 404,
    });

    incSpy.mockRestore();
  });
});
