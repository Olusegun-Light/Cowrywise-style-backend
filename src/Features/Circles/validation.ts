import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const CirclesRegistry = new OpenAPIRegistry();

export const createCircleSchema = z.object({
  name: z.string().min(3).max(100).openapi({ example: "January Ajo" }),
  contributionAmount: z.coerce.number().int().positive().openapi({
    example: 500000,
    description: "Amount in kobo each member contributes per round",
  }),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).openapi({
    example: "MONTHLY",
  }),
  maxMembers: z.coerce.number().int().min(2).max(50).openapi({
    example: 5,
    description: "Total number of members (and payout rounds) in the circle",
  }),
});

const CreateCircleSchema = CirclesRegistry.register(
  "CreateCircleRequest",
  createCircleSchema,
);

CirclesRegistry.registerPath({
  method: "post",
  path: "/circles",
  tags: ["Circles"],
  summary: "Create a new savings circle",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateCircleSchema } },
    },
  },
  responses: {
    201: { description: "Circle created, creator added as member #1" },
  },
});

CirclesRegistry.registerPath({
  method: "post",
  path: "/circles/{circleId}/join",
  tags: ["Circles"],
  summary: "Join an existing circle",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ circleId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    201: { description: "Joined circle" },
    400: {
      description:
        "Circle is full, not open for joining, or you are already a member",
    },
    404: { description: "Circle not found" },
  },
});

CirclesRegistry.registerPath({
  method: "post",
  path: "/circles/{circleId}/contribute",
  tags: ["Circles"],
  summary: "Contribute to the current round of a circle",
  description:
    "Debits the fixed contributionAmount from the caller's wallet. When every member has contributed for the current round, the pooled amount is paid out to that round's recipient (by position) and the circle advances to the next round, or is marked COMPLETED after the final round.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ circleId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    201: {
      description:
        "Contribution recorded (and payout triggered if the round completed)",
    },
    400: {
      description:
        "Circle not active, already contributed this round, or insufficient wallet balance",
    },
    403: { description: "You are not a member of this circle" },
    404: { description: "Circle, wallet, or recipient not found" },
  },
});

CirclesRegistry.registerPath({
  method: "get",
  path: "/circles",
  tags: ["Circles"],
  summary: "List circles the current user belongs to",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Circles retrieved" },
  },
});

CirclesRegistry.registerPath({
  method: "get",
  path: "/circles/{circleId}",
  tags: ["Circles"],
  summary: "Get a single circle, including its member roster",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ circleId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "Circle retrieved" },
    404: { description: "Circle not found, or you are not a member" },
  },
});

CirclesRegistry.registerPath({
  method: "get",
  path: "/circles/{circleId}/contributions",
  tags: ["Circles"],
  summary: "List all contributions made in a circle, across all rounds",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ circleId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "Contributions retrieved" },
    404: { description: "Circle not found, or you are not a member" },
  },
});
