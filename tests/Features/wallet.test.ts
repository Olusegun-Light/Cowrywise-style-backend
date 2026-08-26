import request from "supertest";
import { createHmac } from "crypto";
import app from "../../src/app";
import prisma from "../../src/Config/db";
import { env } from "../../src/Config/env";
import { signupAndLogin } from "../helpers/auth";

const signWebhook = (payload: object) => {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");
  return { body, signature };
};

const fundWalletViaWebhook = async (
  accessToken: string,
  amountKobo: number,
) => {
  const initRes = await request(app)
    .post("/api/v1/wallet/fund")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ amount: amountKobo })
    .expect(200);

  const { reference } = initRes.body.data;

  const payload = { event: "charge.success", data: { reference } };
  const { body, signature } = signWebhook(payload);

  return request(app)
    .post("/api/v1/webhook/paystack")
    .set("Content-Type", "application/json")
    .set("x-paystack-signature", signature)
    .send(body);
};

describe("Wallet", () => {
  describe("funding via webhook", () => {
    it("credits the wallet when a signed charge.success webhook arrives", async () => {
      const { userId, accessToken } = await signupAndLogin();

      const res = await fundWalletViaWebhook(accessToken, 500000);
      expect(res.status).toBe(200);

      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
      });
      expect(wallet.balance).toBe(500000n);

      const txns = await prisma.transaction.findMany({
        where: { walletId: wallet.id },
      });
      expect(txns).toHaveLength(1);
      const txn = txns[0];
      if (!txn) {
        throw new Error("Expected a transaction to exist");
      }
      expect(txn.status).toBe("SUCCESS");
    });

    it("rejects a webhook with an invalid signature and leaves the wallet untouched", async () => {
      const { userId, accessToken } = await signupAndLogin();

      const initRes = await request(app)
        .post("/api/v1/wallet/fund")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amount: 500000 })
        .expect(200);

      const res = await request(app)
        .post("/api/v1/webhook/paystack")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", "not-a-real-signature")
        .send(
          JSON.stringify({
            event: "charge.success",
            data: { reference: initRes.body.data.reference },
          }),
        );

      expect(res.status).toBe(401);

      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
      });
      expect(wallet.balance).toBe(0n);
    });

    it("does not double-credit when the same webhook is replayed", async () => {
      const { userId, accessToken } = await signupAndLogin();

      await fundWalletViaWebhook(accessToken, 300000);

      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
      });
      const [lastTxn] = await prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      if (!lastTxn) {
        throw new Error("Expected a transaction to exist");
      }

      const payload = {
        event: "charge.success",
        data: { reference: lastTxn.providerReference },
      };
      const { body, signature } = signWebhook(payload);

      const replayRes = await request(app)
        .post("/api/v1/webhook/paystack")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", signature)
        .send(body);

      expect(replayRes.status).toBe(200);

      const walletAfterReplay = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
      });
      expect(walletAfterReplay.balance).toBe(300000n);
    });
  });

  describe("POST /api/v1/wallet/withdraw", () => {
    it("rejects a withdrawal larger than the wallet balance", async () => {
      const { accessToken } = await signupAndLogin();

      const res = await request(app)
        .post("/api/v1/wallet/withdraw")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          amount: 100000,
          accountNumber: "0000000000",
          bankCode: "000",
          accountName: "Test Person",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient/i);
    });

    it("debits the wallet for a valid withdrawal within balance", async () => {
      const { userId, accessToken } = await signupAndLogin();

      await fundWalletViaWebhook(accessToken, 200000);

      const res = await request(app)
        .post("/api/v1/wallet/withdraw")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          amount: 50000,
          accountNumber: "0000000000",
          bankCode: "000",
          accountName: "Test Person",
        });

      expect(res.status).toBe(200);

      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
      });
      expect(wallet.balance).toBe(150000n);
    });
  });
});
