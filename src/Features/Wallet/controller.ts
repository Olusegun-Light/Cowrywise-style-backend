import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import { paystack, callPaystack } from "../../Utils/paystack";
import * as walletService from "./service";
import {
  fundWalletSchema,
  listTransactionsQuerySchema,
  withdrawSchema,
} from "./validation";

interface PaystackInitializeResponse {
  authorization_url: string;
}

interface PaystackVerifyResponse {
  status: string;
}

export default class WalletController {
  static async fund(req: Request, res: Response) {
    const { amount } = validateBody(fundWalletSchema, req.body);

    const wallet = await walletService.getWalletByUserId(req.user!.id);
    const reference = `fund_${randomUUID()}`;

    await walletService.createPendingTransaction({
      walletId: wallet.id,
      type: "FUNDING",
      amount: BigInt(amount),
      reference,
    });

    const result = await callPaystack<PaystackInitializeResponse>(() =>
      paystack.post("/transaction/initialize", {
        email: req.user!.email,
        amount,
        reference,
      }),
    );

    return successResponse({
      res,
      message: "Funding Initialized",
      data: {
        authorizationUrl: result.authorization_url,
        reference,
      },
    });
  }

  static async verifyFunding(req: Request, res: Response) {
    const { reference } = req.params;
    if (!reference) {
      throw new AppError("Reference is required", 400);
    }

    const result = await callPaystack<PaystackVerifyResponse>(() =>
      paystack.get(`/transaction/verify/${reference}`),
    );

    if (result.status !== "success") {
      throw new AppError(
        `Payment not successful (status: ${result.status})`,
        400,
      );
    }

    const creditResult =
      await walletService.creditWalletForReference(reference);

    return successResponse({
      res,
      message: creditResult.alreadyProcessed
        ? "Payment already processed"
        : "Wallet funded successfully",
    });
  }

  static async withdraw(req: Request, res: Response) {
    const { amount, accountNumber, bankCode, accountName } = validateBody(
      withdrawSchema,
      req.body,
    );

    const reference = `withdraw_${randomUUID()}`;

    await walletService.initiateWithdrawal(
      req.user!.id,
      BigInt(amount),
      reference,
    );

    try {
      const recipient = await callPaystack<{ recipient_code: string }>(() =>
        paystack.post("/transferrecipient", {
          type: "nuban",
          name: accountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN",
        }),
      );

      await callPaystack(() =>
        paystack.post("/transfer", {
          source: "balance",
          amount,
          recipient: recipient.recipient_code,
          reason: "Wallet withdrawal",
          reference,
        }),
      );
    } catch (err) {
      await walletService.finalizeWithdrawal(reference, false);
      throw err;
    }

    return successResponse({
      res,
      message: "Withdrawal initiated",
      data: { reference },
    });
  }

  static async getWallet(req: Request, res: Response) {
    const wallet = await walletService.getWalletByUserId(req.user!.id);

    return successResponse({
      res,
      message: "Wallet retrieved",
      data: wallet,
    });
  }

  static async listTransactions(req: Request, res: Response) {
    const { page, limit } = validateBody(
      listTransactionsQuerySchema,
      req.query,
    );

    const wallet = await walletService.getWalletByUserId(req.user!.id);
    const result = await walletService.listTransactions(wallet.id, page, limit);

    return successResponse({
      res,
      message: "Transactions retrieved",
      data: result,
    });
  }
}
