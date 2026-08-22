import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const AdminRegistry = new OpenAPIRegistry();

export const rejectKycSchema = z.object({
  reason: z.string().min(3).max(500).openapi({
    example: "BVN does not match registered name",
    description: "Reason shown to the user for the rejection",
  }),
});

const RejectKycSchema = AdminRegistry.register(
  "RejectKycRequest",
  rejectKycSchema,
);

AdminRegistry.registerPath({
  method: "get",
  path: "/admin/kyc/pending",
  tags: ["Admin"],
  summary: "List KYC submissions pending review",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Pending KYC submissions retrieved" },
  },
});

AdminRegistry.registerPath({
  method: "post",
  path: "/admin/kyc/{userId}/approve",
  tags: ["Admin"],
  summary: "Approve a user's KYC submission",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ userId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "KYC approved" },
    400: { description: "KYC submission is not pending review" },
    404: { description: "User not found" },
  },
});

AdminRegistry.registerPath({
  method: "post",
  path: "/admin/kyc/{userId}/reject",
  tags: ["Admin"],
  summary: "Reject a user's KYC submission",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ userId: z.string().openapi({ example: "uuid" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: RejectKycSchema } },
    },
  },
  responses: {
    200: { description: "KYC rejected" },
    400: {
      description: "KYC submission is not pending review, or validation failed",
    },
    404: { description: "User not found" },
  },
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({ example: 1 }),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .openapi({ example: 20 }),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true"))
    .openapi({
      example: "true",
      description: "Filter by account active/frozen state",
    }),
  kycStatus: z
    .enum(["NOT_SUBMITTED", "PENDING", "APPROVED", "REJECTED"])
    .optional()
    .openapi({ example: "PENDING" }),
});

AdminRegistry.registerPath({
  method: "get",
  path: "/admin/users",
  tags: ["Admin"],
  summary: "List users, paginated and filterable",
  security: [{ bearerAuth: [] }],
  request: {
    query: listUsersQuerySchema,
  },
  responses: {
    200: { description: "Users retrieved" },
  },
});

AdminRegistry.registerPath({
  method: "post",
  path: "/admin/users/{userId}/freeze",
  tags: ["Admin"],
  summary: "Freeze a user's account",
  description:
    "Sets isActive to false, blocking login. Cannot target your own account.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ userId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "User frozen" },
    400: {
      description:
        "User already frozen, or attempted to freeze your own account",
    },
    404: { description: "User not found" },
  },
});

AdminRegistry.registerPath({
  method: "post",
  path: "/admin/users/{userId}/unfreeze",
  tags: ["Admin"],
  summary: "Unfreeze a user's account",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ userId: z.string().openapi({ example: "uuid" }) }),
  },
  responses: {
    200: { description: "User unfrozen" },
    400: { description: "User is not frozen" },
    404: { description: "User not found" },
  },
});

AdminRegistry.registerPath({
  method: "get",
  path: "/admin/stats",
  tags: ["Admin"],
  summary:
    "Basic reporting dashboard — aggregate counts across users, wallets, transactions, savings plans, and circles",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Stats retrieved" },
  },
});

export const createBroadcastSchema = z.object({
  title: z.string().min(1).max(200).openapi({
    example: "Scheduled maintenance",
  }),
  body: z.string().min(1).max(2000).openapi({
    example: "We'll be undergoing maintenance tonight from 11pm-1am WAT.",
  }),
});

const CreateBroadcastSchema = AdminRegistry.register(
  "CreateBroadcastRequest",
  createBroadcastSchema,
);

AdminRegistry.registerPath({
  method: "post",
  path: "/admin/notifications/broadcast",
  tags: ["Admin"],
  summary: "Send a broadcast notification to every user",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateBroadcastSchema } },
    },
  },
  responses: {
    201: { description: "Broadcast sent" },
  },
});
