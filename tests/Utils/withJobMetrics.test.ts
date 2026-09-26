import { withJobMetrics, jobDuration, jobTotal } from "../../src/Utils/metrics";

describe("withJobMetrics", () => {
  it("records success and returns the wrapped function's result", async () => {
    const incSpy = jest.spyOn(jobTotal, "inc");
    const observeSpy = jest.spyOn(jobDuration, "observe");
    const wrapped = withJobMetrics("testJob", async () => "done");

    const result = await wrapped();

    expect(result).toBe("done");
    expect(incSpy).toHaveBeenCalledWith({
      job_name: "testJob",
      status: "success",
    });
    expect(observeSpy).toHaveBeenCalledWith(
      { job_name: "testJob", status: "success" },
      expect.any(Number),
    );

    incSpy.mockRestore();
    observeSpy.mockRestore();
  });

  it("records failure and rethrows the original error", async () => {
    const incSpy = jest.spyOn(jobTotal, "inc");
    const originalError = new Error("job blew up");
    const wrapped = withJobMetrics("testJob", async () => {
      throw originalError;
    });

    await expect(wrapped()).rejects.toThrow(originalError);
    expect(incSpy).toHaveBeenCalledWith({
      job_name: "testJob",
      status: "failure",
    });

    incSpy.mockRestore();
  });
});
