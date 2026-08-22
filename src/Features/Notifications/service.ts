import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import type { NotificationType } from "../../generated/prisma/client";

export const createNotification = (
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
) =>
  prisma.notification.create({
    data: {
      type,
      title,
      body,
      recipients: {
        create: { userId },
      },
    },
  });

export const createBroadcast = async (
  type: NotificationType,
  title: string,
  body: string,
) => {
  const users = await prisma.user.findMany({ select: { id: true } });

  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({
      data: { type, title, body, isBroadcast: true },
    });

    await tx.notificationRecipient.createMany({
      data: users.map((u) => ({
        notificationId: notification.id,
        userId: u.id,
      })),
    });

    return notification;
  });
};

export const listNotificationsForUser = async (
  userId: string,
  page: number,
  limit: number,
) => {
  const [recipients, total, unreadCount] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where: { userId },
      include: { notification: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notificationRecipient.count({ where: { userId } }),
    prisma.notificationRecipient.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications: recipients, total, unreadCount, page, limit };
};

export const markAsRead = async (userId: string, recipientId: string) => {
  const recipient = await prisma.notificationRecipient.findFirst({
    where: { id: recipientId, userId },
  });
  if (!recipient) {
    throw new AppError("Notification not found", 404);
  }

  return prisma.notificationRecipient.update({
    where: { id: recipient.id },
    data: { isRead: true, readAt: new Date() },
  });
};

export const markAllAsRead = (userId: string) =>
  prisma.notificationRecipient.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
