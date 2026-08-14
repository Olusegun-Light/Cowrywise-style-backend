import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const WalletRegistry = new OpenAPIRegistry();

export const fundWalletSchema = z.object({
  amount: z.coerce.number().int().positive().openapi({
    example: 500000,
    description: "Amount in kobo to fund (e.g. 500000 = ₦5,000)",
  }),
});

const FundWalletSchema = WalletRegistry.register(
  "FundWalletRequest",
  fundWalletSchema,
);

WalletRegistry.registerPath({
  method: "post",
  path: "/wallet/fund",
  tags: ["Wallet"],
  summary: "Initialize a wallet funding transaction",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: FundWalletSchema } },
    },
  },
  responses: {
    200: { description: "Paystack checkout URL + reference returned" },
    401: { description: "Not authenticated" },
  },
});

WalletRegistry.registerPath({
  method: "get",
  path: "/wallet/fund/verify/{reference}",
  tags: ["Wallet"],
  summary: "Verify a funding transaction and credit the wallet if successful",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      reference: z.string().openapi({ example: "fund_abc123" }),
    }),
  },
  responses: {
    200: { description: "Wallet funded (or already processed)" },
    400: { description: "Payment not successful" },
    404: { description: "Transaction not found" },
  },
});

export const withdrawSchema = z.object({
  amount: z.coerce.number().int().positive().openapi({
    example: 200000,
    description: "Amount in kobo to withdraw",
  }),
  accountNumber: z
    .string()
    .length(10, "Account number must be 10 digits")
    .openapi({ example: "0123456789" }),
  bankCode: z.string().min(1, "Bank code is required").openapi({
    example: "058",
    description: "Paystack bank code",
  }),
  accountName: z.string().min(1, "Account name is required").openapi({
    example: "Ada Lovelace",
  }),
});

const WithdrawSchema = WalletRegistry.register(
  "WithdrawRequest",
  withdrawSchema,
);

WalletRegistry.registerPath({
  method: "post",
  path: "/wallet/withdraw",
  tags: ["Wallet"],
  summary: "Withdraw funds to a bank account",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: WithdrawSchema } },
    },
  },
  responses: {
    200: { description: "Withdrawal initiated" },
    400: { description: "Insufficient balance" },
    404: { description: "Wallet not found" },
  },
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({ example: 1 }),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .openapi({ example: 20 }),
});

WalletRegistry.registerPath({
  method: "get",
  path: "/wallet",
  tags: ["Wallet"],
  summary: "Get the current user's wallet (including balance)",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Wallet retrieved" },
  },
});

WalletRegistry.registerPath({
  method: "get",
  path: "/wallet/transactions",
  tags: ["Wallet"],
  summary: "List wallet transactions (paginated)",
  security: [{ bearerAuth: [] }],
  request: {
    query: listTransactionsQuerySchema,
  },
  responses: {
    200: { description: "Paginated list of transactions" },
  },
});
