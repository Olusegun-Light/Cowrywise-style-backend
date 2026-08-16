import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const SavingsRegistry = new OpenAPIRegistry();

const createPlanBaseSchema = z.object({
  planType: z
    .enum(["FLEX", "FIXED", "RECURRING"])
    .openapi({ example: "FIXED" }),
  targetAmount: z.coerce.number().int().positive().openapi({
    example: 1000000,
    description: "Target amount in kobo",
  }),
  maturityDate: z.coerce.date().optional().openapi({
    example: "2027-01-01",
    description: "Required for FIXED plans — must be at least 30 days out",
  }),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional().openapi({
    example: "MONTHLY",
    description: "Required for RECURRING plans",
  }),
  recurringAmount: z.coerce.number().int().positive().optional().openapi({
    example: 50000,
    description:
      "Required for RECURRING plans — amount in kobo debited each interval",
  }),
});

export const createPlanSchema = createPlanBaseSchema.superRefine(
  (data, ctx) => {
    if (data.planType === "FIXED") {
      if (!data.maturityDate) {
        ctx.addIssue({
          code: "custom",
          path: ["maturityDate"],
          message: "maturityDate is required for FIXED plans",
        });
      } else {
        const minMaturity = new Date();
        minMaturity.setDate(minMaturity.getDate() + 30);
        if (data.maturityDate < minMaturity) {
          ctx.addIssue({
            code: "custom",
            path: ["maturityDate"],
            message: "maturityDate must be at least 30 days in the future",
          });
        }
      }
    }

    if (data.planType === "RECURRING" && !data.frequency) {
      ctx.addIssue({
        code: "custom",
        path: ["frequency"],
        message: "frequency is required for RECURRING plans",
      });
    }

    if (data.planType === "RECURRING" && !data.recurringAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["recurringAmount"],
        message: "recurringAmount is required for RECURRING plans",
      });
    }
  },
);

const CreatePlanSchema = SavingsRegistry.register(
  "CreatePlanRequest",
  createPlanBaseSchema,
);

SavingsRegistry.registerPath({
  method: "post",
  path: "/savings",
  tags: ["Savings"],
  summary: "Create a savings plan",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreatePlanSchema } },
    },
  },
  responses: {
    201: { description: "Plan created" },
    422: {
      description:
        "Validation failed (missing maturityDate/frequency for the chosen planType)",
    },
  },
});

SavingsRegistry.registerPath({
  method: "get",
  path: "/savings",
  tags: ["Savings"],
  summary: "List the current user's savings plans",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Plans retrieved" },
  },
});

SavingsRegistry.registerPath({
  method: "get",
  path: "/savings/{planId}",
  tags: ["Savings"],
  summary: "Get a single savings plan",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "Plan retrieved" },
    404: { description: "Plan not found" },
  },
});

export const fundPlanSchema = z.object({
  amount: z.coerce.number().int().positive().openapi({
    example: 100000,
    description: "Amount in kobo to move from wallet to this plan",
  }),
});

const FundPlanSchema = SavingsRegistry.register(
  "FundPlanRequest",
  fundPlanSchema,
);

SavingsRegistry.registerPath({
  method: "post",
  path: "/savings/{planId}/fund",
  tags: ["Savings"],
  summary: "Fund a savings plan from the wallet",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().openapi({ example: "uuid" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: FundPlanSchema } },
    },
  },
  responses: {
    200: { description: "Plan funded" },
    400: { description: "Insufficient wallet balance, or plan not active" },
    404: { description: "Wallet or plan not found" },
  },
});

export const withdrawFromPlanSchema = z.object({
  amount: z.coerce.number().int().positive().openapi({
    example: 50000,
    description: "Amount in kobo to withdraw from this plan back to the wallet",
  }),
});

const WithdrawFromPlanSchema = SavingsRegistry.register(
  "WithdrawFromPlanRequest",
  withdrawFromPlanSchema,
);

SavingsRegistry.registerPath({
  method: "post",
  path: "/savings/{planId}/withdraw",
  tags: ["Savings"],
  summary: "Withdraw from a savings plan back to the wallet",
  description:
    "FLEX plans allow partial withdrawal anytime. FIXED plans require full withdrawal, and incur a 5% penalty if withdrawn before maturityDate.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().openapi({ example: "uuid" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: WithdrawFromPlanSchema } },
    },
  },
  responses: {
    200: { description: "Withdrawal successful" },
    400: {
      description:
        "Insufficient plan balance, plan not active, or FIXED partial withdrawal attempted",
    },
    404: { description: "Plan or wallet not found" },
  },
});
