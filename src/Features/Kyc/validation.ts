import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const KycRegistry = new OpenAPIRegistry();

export const submitKycSchema = z.object({
  bvn: z
    .string()
    .regex(/^\d{11}$/, "BVN must be exactly 11 digits")
    .openapi({
      example: "22212345678",
      description: "Bank Verification Number (11 digits)",
    }),
  nin: z
    .string()
    .regex(/^\d{11}$/, "NIN must be exactly 11 digits")
    .openapi({
      example: "12345678901",
      description: "National Identification Number (11 digits)",
    }),
});

const SubmitKycSchema = KycRegistry.register(
  "SubmitKycRequest",
  submitKycSchema,
);

KycRegistry.registerPath({
  method: "post",
  path: "/kyc/submit",
  tags: ["Kyc"],
  summary: "Submit BVN/NIN for KYC review",
  description:
    "Sets kycStatus to PENDING. Allowed when status is NOT_SUBMITTED or REJECTED (resubmission clears any previous rejection reason).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: SubmitKycSchema } },
    },
  },
  responses: {
    200: { description: "KYC submitted, pending review" },
    400: { description: "KYC already pending review or already approved" },
  },
});

KycRegistry.registerPath({
  method: "get",
  path: "/kyc/status",
  tags: ["Kyc"],
  summary: "Get the current user's KYC status",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "KYC status retrieved" },
  },
});
