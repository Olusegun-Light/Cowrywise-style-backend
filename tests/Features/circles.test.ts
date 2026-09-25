import request from "supertest";
import { createHmac } from "crypto";
import app from "../../src/app";
import prisma from "../../src/Config/db";
import { env } from "../../src/Config/env";
import { signupAndLogin } from "../helpers/auth";
import { publishEvent } from "../../src/Utils/eventBus";

const signWebhook = (payload: object) => {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");
  return { body, signature };
};

const fundWallet = async (accessToken: string, amountKobo: number) => {
  const initRes = await request(app)
    .post("/api/v1/wallet/fund")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ amount: amountKobo })
    .expect(200);

  const { reference } = initRes.body.data;
  const payload = { event: "charge.success", data: { reference } };
  const { body, signature } = signWebhook(payload);

  await request(app)
    .post("/api/v1/webhook/paystack")
    .set("Content-Type", "application/json")
    .set("x-paystack-signature", signature)
    .send(body)
    .expect(200);
};

describe("Circles full lifecycle", () => {
  it("runs a complete 2-member Ajo cycle: create, join, two rounds of contribute+payout, completion", async () => {
    const alice = await signupAndLogin();
    const bob = await signupAndLogin();

    await fundWallet(alice.accessToken, 1000000);
    await fundWallet(bob.accessToken, 1000000);

    const createRes = await request(app)
      .post("/api/v1/circles")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({
        name: "Test Ajo",
        contributionAmount: 200000,
        frequency: "MONTHLY",
        maxMembers: 2,
      })
      .expect(201);

    const circleId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe("PENDING");

    const joinRes = await request(app)
      .post(`/api/v1/circles/${circleId}/join`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    expect(joinRes.body.data.position).toBe(2);

    const circleAfterJoin = await prisma.circle.findUniqueOrThrow({
      where: { id: circleId },
    });
    expect(circleAfterJoin.status).toBe("ACTIVE");

    const aliceRound1 = await request(app)
      .post(`/api/v1/circles/${circleId}/contribute`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);
    expect(aliceRound1.body.data.payoutTriggered).toBe(false);

    const bobRound1 = await request(app)
      .post(`/api/v1/circles/${circleId}/contribute`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);
    expect(bobRound1.body.data.payoutTriggered).toBe(true);
    expect(bobRound1.body.data.round).toBe(1);

    expect(publishEvent).toHaveBeenCalledWith("circle.payout", {
      userId: alice.userId,
      circleId,
      round: 1,
    });

    const aliceWalletAfterR1 = await prisma.wallet.findUniqueOrThrow({
      where: { userId: alice.userId },
    });
    expect(aliceWalletAfterR1.balance).toBe(1200000n);

    const bobWalletAfterR1 = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bob.userId },
    });
    expect(bobWalletAfterR1.balance).toBe(800000n);

    const circleAfterR1 = await prisma.circle.findUniqueOrThrow({
      where: { id: circleId },
    });
    expect(circleAfterR1.currentRound).toBe(2);
    expect(circleAfterR1.status).toBe("ACTIVE");

    await request(app)
      .post(`/api/v1/circles/${circleId}/contribute`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);

    const bobRound2 = await request(app)
      .post(`/api/v1/circles/${circleId}/contribute`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);
    expect(bobRound2.body.data.payoutTriggered).toBe(true);

    const circleAfterR2 = await prisma.circle.findUniqueOrThrow({
      where: { id: circleId },
    });
    expect(circleAfterR2.status).toBe("COMPLETED");

    const aliceFinal = await prisma.wallet.findUniqueOrThrow({
      where: { userId: alice.userId },
    });
    const bobFinal = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bob.userId },
    });
    expect(aliceFinal.balance).toBe(1000000n);
    expect(bobFinal.balance).toBe(1000000n);

    const aliceTxnSum = await prisma.transaction.aggregate({
      where: {
        walletId: (
          await prisma.wallet.findUniqueOrThrow({
            where: { userId: alice.userId },
          })
        ).id,
        status: "SUCCESS",
      },
      _sum: { amount: true },
    });
    expect(aliceTxnSum._sum.amount).toBe(aliceFinal.balance);

    const bobTxnSum = await prisma.transaction.aggregate({
      where: {
        walletId: (
          await prisma.wallet.findUniqueOrThrow({
            where: { userId: bob.userId },
          })
        ).id,
        status: "SUCCESS",
      },
      _sum: { amount: true },
    });
    expect(bobTxnSum._sum.amount).toBe(bobFinal.balance);
  });

  it("rejects contributing twice in the same round", async () => {
    const alice = await signupAndLogin();
    const bob = await signupAndLogin();

    await fundWallet(alice.accessToken, 1000000);
    await fundWallet(bob.accessToken, 1000000);

    const createRes = await request(app)
      .post("/api/v1/circles")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({
        name: "Double Contribute Test",
        contributionAmount: 100000,
        frequency: "WEEKLY",
        maxMembers: 2,
      })
      .expect(201);

    const circleId = createRes.body.data.id;

    await request(app)
      .post(`/api/v1/circles/${circleId}/join`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    await request(app)
      .post(`/api/v1/circles/${circleId}/contribute`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);

    const res = await request(app)
      .post(`/api/v1/circles/${circleId}/contribute`)
      .set("Authorization", `Bearer ${alice.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already contributed/i);
  });
});
