jest.mock("../src/Utils/mailer");
jest.mock("../src/Utils/paystack");
jest.mock("../src/Utils/eventBus");

import { redisClient } from "../src/Config/redis";
import prisma from "../src/Config/db";

beforeAll(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await redisClient.quit();
  await prisma.$disconnect();
});
