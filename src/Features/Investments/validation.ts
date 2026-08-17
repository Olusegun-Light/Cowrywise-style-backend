import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const InvestmentsRegistry = new OpenAPIRegistry();

export const updateNavSchema = z.object({
  navPerUnit: z.coerce.number().positive().openapi({
    example: 105.25,
    description: "New NAV per unit, in kobo (e.g. 105.25 = ₦1.0525/unit)",
  }),
});

const UpdateNavSchema = InvestmentsRegistry.register(
  "UpdateNavRequest",
  updateNavSchema,
);

InvestmentsRegistry.registerPath({
  method: "patch",
  path: "/funds/{fundId}/nav",
  tags: ["Investments"],
  summary: "Update a fund's NAV per unit (admin only)",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ fundId: z.string().openapi({ example: "uuid" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: UpdateNavSchema } },
    },
  },
  responses: {
    200: { description: "NAV updated" },
    403: { description: "Admin access required" },
    404: { description: "Fund not found" },
  },
});
