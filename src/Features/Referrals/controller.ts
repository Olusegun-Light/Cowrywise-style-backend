import type { Request, Response } from "express";
import { successResponse } from "../../Utils/responseHandler";
import * as referralsService from "./service";

export default class ReferralsController {
  static async getMySummary(req: Request, res: Response) {
    const summary = await referralsService.getMyReferralSummary(req.user!.id);

    return successResponse({
      res,
      message: "Referral summary retrieved",
      data: summary,
    });
  }
}
