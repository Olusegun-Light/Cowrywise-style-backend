import type { Request, Response } from "express";
import { errorHandler } from "../../src/Middlewares/errorHandler";

const buildRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("errorHandler", () => {
  it("does not throw and returns a clean 500 when req.log is undefined (as in test env, where httpLogger is skipped)", () => {
    const req = {} as Request;
    const res = buildRes();
    const err = new TypeError("Cannot read properties of undefined");

    expect(() => errorHandler(err, req, res, jest.fn())).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "An unexpected error occurred",
      data: undefined,
    });
  });

  it("uses req.log when it is attached, instead of the fallback logger", () => {
    const logError = jest.fn();
    const req = { log: { error: logError } } as unknown as Request;
    const res = buildRes();
    const err = new Error("boom");

    errorHandler(err, req, res, jest.fn());

    expect(logError).toHaveBeenCalledWith({ err }, "Unhandled error");
  });
});
