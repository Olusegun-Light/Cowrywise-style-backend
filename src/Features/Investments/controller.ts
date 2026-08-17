import type { Request, Response } from "express";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as investmentsService from "./service";
import { updateNavSchema } from "./validation";

export default class InvestmentController {
  static async updateNav(req: Request, res: Response) {
    const { fundId } = req.params;
    if (!fundId) {
      throw new AppError("Fund ID is required", 400);
    }

    const { navPerUnit } = validateBody(updateNavSchema, req.body);

    const fund = await investmentsService.updateFundNav(fundId, navPerUnit);

    return successResponse({
      res,
      message: "NAV updated",
      data: fund,
    });
  }
}
