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

InvestmentsRegistry.registerPath({
  method: "get",
  path: "/funds",
  tags: ["Investments"],
  summary: "List active funds",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Funds retrieved" },
  },
});

InvestmentsRegistry.registerPath({
  method: "get",
  path: "/funds/{fundId}",
  tags: ["Investments"],
  summary: "Get a single fund",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ fundId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "Fund retrieved" },
    404: { description: "Fund not found" },
  },
});

export const buyFundSchema = z.object({
  amount: z.coerce.number().int().positive().openapi({
    example: 500000,
    description: "Amount in kobo to invest from the wallet",
  }),
});

const BuyFundSchema = InvestmentsRegistry.register(
  "BuyFundRequest",
  buyFundSchema,
);

InvestmentsRegistry.registerPath({
  method: "post",
  path: "/funds/{fundId}/buy",
  tags: ["Investments"],
  summary: "Buy units of a fund using wallet balance",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ fundId: z.string().openapi({ example: "uuid" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: BuyFundSchema } },
    },
  },
  responses: {
    200: { description: "Units purchased" },
    400: { description: "Insufficient wallet balance, or fund not active" },
    404: { description: "Fund or wallet not found" },
  },
});

export const redeemFundSchema = z.object({
  units: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "units must be a positive decimal number")
    .openapi({
      example: "50.123456",
      description:
        "Number of units to redeem, as a decimal string (preserves full precision)",
    }),
});

const RedeemFundSchema = InvestmentsRegistry.register(
  "RedeemFundRequest",
  redeemFundSchema,
);

InvestmentsRegistry.registerPath({
  method: "post",
  path: "/funds/{fundId}/redeem",
  tags: ["Investments"],
  summary: "Redeem units of a fund back to the wallet",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ fundId: z.string().openapi({ example: "uuid" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: RedeemFundSchema } },
    },
  },
  responses: {
    200: { description: "Units redeemed" },
    400: { description: "Insufficient units" },
    404: { description: "Fund, holding, or wallet not found" },
  },
});

InvestmentsRegistry.registerPath({
  method: "get",
  path: "/funds/holdings",
  tags: ["Investments"],
  summary: "List the current user's fund holdings (portfolio)",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Holdings retrieved" },
  },
});

InvestmentsRegistry.registerPath({
  method: "get",
  path: "/funds/{fundId}/holding",
  tags: ["Investments"],
  summary: "Get the current user's holding in a specific fund",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ fundId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "Holding retrieved" },
    404: { description: "No holding in this fund" },
  },
});
