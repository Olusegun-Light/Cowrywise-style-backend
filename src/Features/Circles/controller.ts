import type { Request, Response } from "express";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as circlesService from "./service";
import { createCircleSchema } from "./validation";
import * as notificationsService from "../Notifications/service";

export default class CircleController {
  static async createCircle(req: Request, res: Response) {
    const { name, contributionAmount, frequency, maxMembers } = validateBody(
      createCircleSchema,
      req.body,
    );

    const circle = await circlesService.createCircle({
      creatorId: req.user!.id,
      name,
      contributionAmount: BigInt(contributionAmount),
      frequency,
      maxMembers,
    });

    return successResponse({
      res,
      statusCode: 201,
      message: "Circle created",
      data: circle,
    });
  }

  static async joinCircle(req: Request, res: Response) {
    const { circleId } = req.params;
    if (!circleId) {
      throw new AppError("Circle ID is required", 400);
    }

    const member = await circlesService.joinCircle(circleId, req.user!.id);

    return successResponse({
      res,
      statusCode: 201,
      message: "Joined circle successfully",
      data: member,
    });
  }

  static async contribute(req: Request, res: Response) {
    const { circleId } = req.params;
    if (!circleId) {
      throw new AppError("Circle ID is required", 400);
    }

    const result = await circlesService.contributeToCircle(
      circleId,
      req.user!.id,
    );

    if (result.payoutTriggered && result.recipientUserId) {
      try {
        await notificationsService.createNotification(
          result.recipientUserId,
          "CIRCLE",
          "Circle payout received",
          "Your circle round has completed and the payout has been credited to your wallet.",
        );
      } catch (err) {
        console.error("Failed to create circle payout notification:", err);
      }
    }

    return successResponse({
      res,
      statusCode: 201,
      message: result.payoutTriggered
        ? "Contribution recorded and round payout completed"
        : "Contribution recorded",
      data: result,
    });
  }

  static async listCircles(req: Request, res: Response) {
    const circles = await circlesService.listCirclesForUser(req.user!.id);

    return successResponse({
      res,
      message: "Circles retrieved",
      data: circles,
    });
  }

  static async getCircle(req: Request, res: Response) {
    const { circleId } = req.params;
    if (!circleId) {
      throw new AppError("Circle ID is required", 400);
    }

    const circle = await circlesService.getCircleByIdForUser(
      req.user!.id,
      circleId,
    );

    return successResponse({
      res,
      message: "Circle retrieved",
      data: circle,
    });
  }

  static async listContributions(req: Request, res: Response) {
    const { circleId } = req.params;
    if (!circleId) {
      throw new AppError("Circle ID is required", 400);
    }

    const contributions = await circlesService.listContributionsForCircle(
      req.user!.id,
      circleId,
    );

    return successResponse({
      res,
      message: "Contributions retrieved",
      data: contributions,
    });
  }
}
