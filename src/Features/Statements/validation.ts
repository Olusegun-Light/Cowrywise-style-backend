import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const StatementsRegistry = new OpenAPIRegistry();

export const walletStatementQuerySchema = z
  .object({
    from: z.coerce.date().openapi({
      example: "2026-08-01",
      description: "Start of the statement period (inclusive)",
    }),
    to: z.coerce.date().openapi({
      example: "2026-08-31",
      description: "End of the statement period (inclusive)",
    }),
    format: z.enum(["pdf", "csv"]).default("pdf").openapi({ example: "pdf" }),
  })
  .refine((data) => data.to >= data.from, {
    message: "'to' date must not be before 'from' date",
    path: ["to"],
  });

StatementsRegistry.registerPath({
  method: "get",
  path: "/statements/wallet",
  tags: ["Statements"],
  summary: "Download a wallet statement (PDF or CSV) for a date range",
  security: [{ bearerAuth: [] }],
  request: {
    query: walletStatementQuerySchema,
  },
  responses: {
    200: { description: "Statement file" },
    400: { description: "'to' date is before 'from' date" },
    404: { description: "Wallet not found" },
  },
});

StatementsRegistry.registerPath({
  method: "get",
  path: "/statements/transactions/{transactionId}/receipt",
  tags: ["Statements"],
  summary: "Download a PDF receipt for a single transaction",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      transactionId: z.string().openapi({ example: "uuid" }),
    }),
  },
  responses: {
    200: { description: "Receipt PDF" },
    404: { description: "Transaction not found" },
  },
});
