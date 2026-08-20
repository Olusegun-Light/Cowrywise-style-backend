import type { Request, Response } from "express";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as kycService from "./service";
import { submitKycSchema } from "./validation";

export default class KycController {
  static async submit(req: Request, res: Response) {
    const { bvn, nin } = validateBody(submitKycSchema, req.body);

    const result = await kycService.submitKyc(req.user!.id, bvn, nin);

    return successResponse({
      res,
      message: "KYC submitted, pending review",
      data: result,
    });
  }

  static async getStatus(req: Request, res: Response) {
    const status = await kycService.getKycStatus(req.user!.id);

    return successResponse({
      res,
      message: "KYC status retrieved",
      data: status,
    });
  }
}
