import type { Request, Response } from "express";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as investmentsService from "./service";
import { updateNavSchema, buyFundSchema, redeemFundSchema } from "./validation";

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

  static async listFunds(req: Request, res: Response) {
    const funds = await investmentsService.listActiveFunds();

    return successResponse({ res, message: "Funds retrieved", data: funds });
  }

  static async getFund(req: Request, res: Response) {
    const { fundId } = req.params;
    if (!fundId) {
      throw new AppError("Fund ID is required", 400);
    }

    const fund = await investmentsService.getFundById(fundId);

    return successResponse({ res, message: "Fund retrieved", data: fund });
  }

  static async buyFund(req: Request, res: Response) {
    const { fundId } = req.params;
    if (!fundId) {
      throw new AppError("Fund ID is required", 400);
    }

    const { amount } = validateBody(buyFundSchema, req.body);

    const result = await investmentsService.buyFundUnits(
      req.user!.id,
      fundId,
      BigInt(amount),
    );

    return successResponse({
      res,
      message: "Units purchased successfully",
      data: result,
    });
  }

  static async redeemFund(req: Request, res: Response) {
    const { fundId } = req.params;
    if (!fundId) {
      throw new AppError("Fund ID is required", 400);
    }

    const { units } = validateBody(redeemFundSchema, req.body);

    const result = await investmentsService.redeemFundUnits(
      req.user!.id,
      fundId,
      units,
    );

    return successResponse({
      res,
      message: "Units redeemed successfully",
      data: result,
    });
  }

  static async listHoldings(req: Request, res: Response) {
    const holdings = await investmentsService.listHoldingsForUser(req.user!.id);

    return successResponse({
      res,
      message: "Holdings retrieved",
      data: holdings,
    });
  }

  static async getHolding(req: Request, res: Response) {
    const { fundId } = req.params;
    if (!fundId) {
      throw new AppError("Fund ID is required", 400);
    }

    const holding = await investmentsService.getHoldingForUserAndFund(
      req.user!.id,
      fundId,
    );
    return successResponse({
      res,
      message: "Holding retrieved",
      data: holding,
    });
  }
}
