import type { Request, Response } from "express";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as adminService from "./service";
import {
  rejectKycSchema,
  listUsersQuerySchema,
  createBroadcastSchema,
} from "./validation";
import * as notificationsService from "../Notifications/service";

export default class AdminController {
  static async listPendingKyc(req: Request, res: Response) {
    const pending = await adminService.listPendingKyc();

    return successResponse({
      res,
      message: "Pending KYC submissions retrieved",
      data: pending,
    });
  }

  static async approveKyc(req: Request, res: Response) {
    const { userId } = req.params;
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const result = await adminService.approveKyc(userId);

    return successResponse({
      res,
      message: "KYC approved",
      data: result,
    });
  }

  static async rejectKyc(req: Request, res: Response) {
    const { userId } = req.params;
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const { reason } = validateBody(rejectKycSchema, req.body);

    const result = await adminService.rejectKyc(userId, reason);

    return successResponse({
      res,
      message: "KYC rejected",
      data: result,
    });
  }

  static async listUsers(req: Request, res: Response) {
    const { page, limit, isActive, kycStatus } = validateBody(
      listUsersQuerySchema,
      req.query,
    );

    const result = await adminService.listUsers(page, limit, {
      isActive,
      kycStatus,
    });

    return successResponse({
      res,
      message: "Users retrieved",
      data: result,
    });
  }

  static async freezeUser(req: Request, res: Response) {
    const { userId } = req.params;
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const result = await adminService.freezeUser(userId, req.user!.id);

    return successResponse({
      res,
      message: "User frozen",
      data: result,
    });
  }

  static async unfreezeUser(req: Request, res: Response) {
    const { userId } = req.params;
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const result = await adminService.unfreezeUser(userId);

    return successResponse({
      res,
      message: "User unfrozen",
      data: result,
    });
  }

  static async getStats(req: Request, res: Response) {
    const stats = await adminService.getAdminStats();

    return successResponse({
      res,
      message: "Admin stats retrieved",
      data: stats,
    });
  }

  static async sendBroadcast(req: Request, res: Response) {
    const { title, body } = validateBody(createBroadcastSchema, req.body);

    const notification = await notificationsService.createBroadcast(
      "BROADCAST",
      title,
      body,
    );

    return successResponse({
      res,
      statusCode: 201,
      message: "Broadcast sent",
      data: notification,
    });
  }
}
