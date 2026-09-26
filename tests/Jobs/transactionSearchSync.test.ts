jest.mock("../../src/Features/Search/service");

import request from "supertest";
import { createHmac } from "crypto";
import app from "../../src/app";
import prisma from "../../src/Config/db";
import { env } from "../../src/Config/env";
import {
  runTransactionSearchSync,
  transactionSearchSyncQueue,
} from "../../src/Jobs/transactionSearchSync";
import * as searchService from "../../src/Features/Search/service";
import { signupAndLogin } from "../helpers/auth";

const fundWallet = async (accessToken: string, amountKobo: number) => {
  const initRes = await request(app)
    .post("/api/v1/wallet/fund")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ amount: amountKobo })
    .expect(200);

  const { reference } = initRes.body.data;
  const payload = { event: "charge.success", data: { reference } };
  const body = JSON.stringify(payload);
  const signature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");

  await request(app)
    .post("/api/v1/webhook/paystack")
    .set("Content-Type", "application/json")
    .set("x-paystack-signature", signature)
    .send(body)
    .expect(200);
};

describe("runTransactionSearchSync", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await transactionSearchSyncQueue.close();
  });

  it("indexes transactions updated within the rolling window, with the resolved user attached", async () => {
    const user = await signupAndLogin();
    await fundWallet(user.accessToken, 100000);

    await runTransactionSearchSync();

    const call = (searchService.indexTransaction as jest.Mock).mock.calls.find(
      ([, userArg]) => userArg.id === user.userId,
    );
    expect(call).toBeDefined();
    const [transactionArg, userArg] = call!;
    expect(transactionArg.type).toBe("FUNDING");
    expect(userArg.email).toBe(user.user.email);
  });

  it("does not index transactions outside the rolling window", async () => {
    const user = await signupAndLogin();
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    const oldTransaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "FUNDING",
        amount: 1000n,
        status: "SUCCESS",
        providerReference: `old_${Date.now()}`,
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    await runTransactionSearchSync();

    const calledWithOld = (
      searchService.indexTransaction as jest.Mock
    ).mock.calls.some(([t]: [{ id: string }]) => t.id === oldTransaction.id);
    expect(calledWithOld).toBe(false);
  });
});
