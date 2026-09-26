import express from "express";
import request from "supertest";

// Mirrors the exact conditional in src/app.ts:
//   if (env.TRUST_PROXY) { app.set("trust proxy", 1); }
// Built standalone rather than importing the real app, since env.TRUST_PROXY
// is read once at module-import time and is fixed to false for the whole
// test run (via .env.test) — this is the only way to exercise the
// trust-proxy-enabled branch at all.
const buildApp = (trustProxy: boolean) => {
  const app = express();
  if (trustProxy) {
    app.set("trust proxy", 1);
  }
  app.get("/whoami", (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
};

describe("trust proxy (mirrors src/app.ts's env-gated app.set call)", () => {
  it("ignores X-Forwarded-For entirely when trust proxy is off — a client can't spoof req.ip", async () => {
    const app = buildApp(false);

    const res = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "203.0.113.5, 10.0.0.9");

    expect(res.body.ip).not.toBe("203.0.113.5");
    expect(res.body.ip).not.toBe("10.0.0.9");
  });

  it("trusts exactly one hop when enabled — uses the proxy's own appended entry, not the client-supplied one", async () => {
    const app = buildApp(true);

    const res = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "203.0.113.5, 10.0.0.9");

    expect(res.body.ip).toBe("10.0.0.9");
    expect(res.body.ip).not.toBe("203.0.113.5");
  });
});
