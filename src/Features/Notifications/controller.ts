import type { Request, Response } from "express";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import * as notificationsService from "./service";
import { listNotificationsQuerySchema } from "./validation";

export default class NotificationsController {
  static async list(req: Request, res: Response) {
    const { page, limit } = validateBody(
      listNotificationsQuerySchema,
      req.query,
    );

    const result = await notificationsService.listNotificationsForUser(
      req.user!.id,
      page,
      limit,
    );

    return successResponse({
      res,
      message: "Notifications retrieved",
      data: result,
    });
  }

  static async markRead(req: Request, res: Response) {
    const { notificationId } = req.params;
    if (!notificationId) {
      throw new AppError("Notification ID is required", 400);
    }

    const notification = await notificationsService.markAsRead(
      req.user!.id,
      notificationId,
    );

    return successResponse({
      res,
      message: "Notification marked as read",
      data: notification,
    });
  }

  static async markAllRead(req: Request, res: Response) {
    await notificationsService.markAllAsRead(req.user!.id);

    return successResponse({
      res,
      message: "All notifications marked as read",
    });
  }
}
