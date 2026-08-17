import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

import { AuthRegistry } from "../Features/Auth/validation";
import { WalletRegistry } from "../Features/Wallet/validation";
import { SavingsRegistry } from "../Features/Savings/validation";
import { InvestmentsRegistry } from "../Features/Investments/validation";

const mainRegistry = new OpenAPIRegistry();

mainRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const generator = new OpenApiGeneratorV3([
  ...mainRegistry.definitions,
  ...AuthRegistry.definitions,
  ...WalletRegistry.definitions,
  ...SavingsRegistry.definitions,
  ...InvestmentsRegistry.definitions,
]);

const openApiDocument = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Cowrywise API Docs",
    version: "1.0.0",
    description: "API for the Cowrywise-style savings & investment backend",
  },
  servers: [
    {
      url: "http://localhost:3000/api/v1",
      description: "Local server",
    },
  ],
});

export default openApiDocument;
