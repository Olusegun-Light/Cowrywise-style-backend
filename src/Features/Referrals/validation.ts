import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const ReferralsRegistry = new OpenAPIRegistry();

ReferralsRegistry.registerPath({
  method: "get",
  path: "/referrals/me",
  tags: ["Referrals"],
  summary:
    "Get the current user's referral code, referral list, and total rewards earned",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Referral summary retrieved" },
  },
});
