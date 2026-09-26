import request from "supertest";
import app from "../../src/app";
import { register } from "../../src/Utils/metrics";
import { signupAndLogin } from "../helpers/auth";

describe("httpMetrics — real Express integration", () => {
  const getRouteLabels = async () => {
    const text = await register.metrics();
    return text.split("\n").filter((l) => l.startsWith("http_requests_total{"));
  };

  it('labels a root-route validation error with its full mount prefix, not just "/"', async () => {
    const user = await signupAndLogin();

    await request(app)
      .post("/api/v1/circles")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({})
      .expect(422);

    const lines = await getRouteLabels();
    expect(
      lines.some(
        (l) =>
          l.includes('route="/api/v1/circles"') &&
          l.includes('status_code="422"'),
      ),
    ).toBe(true);
  });

  it("labels a parameterized-route error with the correct prefix and pattern", async () => {
    const user = await signupAndLogin();

    await request(app)
      .post("/api/v1/circles/00000000-0000-0000-0000-000000000000/join")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(404);

    const lines = await getRouteLabels();
    expect(
      lines.some(
        (l) =>
          l.includes('route="/api/v1/circles/:circleId/join"') &&
          l.includes('status_code="404"'),
      ),
    ).toBe(true);
  });

  it("uses a bounded placeholder, not the raw URL, for a 401 from protect", async () => {
    await request(app)
      .get("/api/v1/circles/some-real-looking-id-1")
      .expect(401);
    await request(app)
      .get("/api/v1/circles/some-real-looking-id-2")
      .expect(401);

    const lines = await getRouteLabels();

    expect(
      lines.some(
        (l) =>
          l.includes('route="<unmatched>"') && l.includes('status_code="401"'),
      ),
    ).toBe(true);
    expect(lines.some((l) => l.includes("some-real-looking-id-1"))).toBe(false);
    expect(lines.some((l) => l.includes("some-real-looking-id-2"))).toBe(false);
  });

  it("uses a bounded placeholder for a genuine 404", async () => {
    await request(app).get("/api/v1/this-does-not-exist").expect(404);

    const lines = await getRouteLabels();
    expect(
      lines.some(
        (l) =>
          l.includes('route="<unmatched>"') && l.includes('status_code="404"'),
      ),
    ).toBe(true);
  });

  it("counts a request rejected by body-parsing before it ever reaches routing", async () => {
    // express.json()'s SyntaxError isn't an AppError/ZodError, so this
    // project's errorHandler treats it as an unexpected error (500) —
    // pre-existing behavior, unrelated to this fix. The point here is just
    // that a pre-routing rejection still gets counted at all.
    await request(app)
      .post("/api/v1/circles")
      .set("Content-Type", "application/json")
      .send("{not valid json")
      .expect(500);

    const lines = await getRouteLabels();
    expect(
      lines.some(
        (l) =>
          l.includes('route="<unmatched>"') && l.includes('status_code="500"'),
      ),
    ).toBe(true);
  });
});
