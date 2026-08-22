import type { Request, Response } from "express";
import { createHmac } from "crypto";
import { env } from "../../Config/env";
import { AppError } from "../../Utils/AppError";
import { successResponse } from "../../Utils/responseHandler";
import * as walletService from "../Wallet/service";
import * as referralsService from "../Referrals/service";

interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
  };
}

export default class WebhookController {
  static async handlePaystackWebhook(req: Request, res: Response) {
    const signature = req.headers["x-paystack-signature"];

    const expectedSignature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody ?? Buffer.from(""))
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new AppError("Invalid signature", 401);
    }

    const payload = req.body as PaystackWebhookPayload;

    if (!payload?.event || !payload?.data?.reference) {
      throw new AppError("Malformed webhook payload", 400);
    }

    switch (payload.event) {
      case "charge.success": {
        const result = await walletService.creditWalletForReference(
          payload.data.reference,
        );
        if (!result.alreadyProcessed) {
          await referralsService.rewardReferralIfFirstFunding(result.walletId);
        }
        break;
      }
      case "transfer.success":
        await walletService.finalizeWithdrawal(payload.data.reference, true);
        break;
      case "transfer.failed":
      case "transfer.reversed":
        await walletService.finalizeWithdrawal(payload.data.reference, false);
        break;
      default:
        break;
    }

    return successResponse({ res, message: "Webhook processed" });
  }
}
