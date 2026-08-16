import type { Request, Response } from "express";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as savingsService from "./service";
import {
  createPlanSchema,
  fundPlanSchema,
  withdrawFromPlanSchema,
} from "./validation";

export default class SavingsController {
  static async createPlan(req: Request, res: Response) {
    const { planType, targetAmount, maturityDate, frequency, recurringAmount } =
      validateBody(createPlanSchema, req.body);

    const plan = await savingsService.createPlan({
      userId: req.user!.id,
      planType,
      targetAmount: BigInt(targetAmount),
      maturityDate,
      frequency,
      recurringAmount: recurringAmount ? BigInt(recurringAmount) : undefined,
    });

    return successResponse({
      res,
      statusCode: 201,
      message: "Savings plan created",
      data: plan,
    });
  }

  static async listPlans(req: Request, res: Response) {
    const plans = await savingsService.listPlansForUser(req.user!.id);

    return successResponse({
      res,
      message: "Savings plans retrieved",
      data: plans,
    });
  }

  static async getPlan(req: Request, res: Response) {
    const { planId } = req.params;
    if (!planId) {
      throw new AppError("Plan ID is required", 400);
    }

    const plan = await savingsService.getPlanByIdForUser(req.user!.id, planId);

    return successResponse({
      res,
      message: "Savings plan retrieved",
      data: plan,
    });
  }

  static async fundPlan(req: Request, res: Response) {
    const { planId } = req.params;
    if (!planId) {
      throw new AppError("Plan ID is required", 400);
    }

    const { amount } = validateBody(fundPlanSchema, req.body);

    await savingsService.fundPlanFromWallet(
      req.user!.id,
      planId,
      BigInt(amount),
    );

    return successResponse({ res, message: "Plan funded successfully" });
  }

  static async withdrawFromPlan(req: Request, res: Response) {
    const { planId } = req.params;
    if (!planId) {
      throw new AppError("Plan ID is required", 400);
    }

    const { amount } = validateBody(withdrawFromPlanSchema, req.body);

    const result = await savingsService.withdrawFromPlan(
      req.user!.id,
      planId,
      BigInt(amount),
    );

    return successResponse({
      res,
      message: "Withdrawal successful",
      data: result,
    });
  }
}
