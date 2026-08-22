import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const NotificationsRegistry = new OpenAPIRegistry();

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({ example: 1 }),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .openapi({ example: 20 }),
});

NotificationsRegistry.registerPath({
  method: "get",
  path: "/notifications",
  tags: ["Notifications"],
  summary: "List the current user's notifications, paginated",
  security: [{ bearerAuth: [] }],
  request: { query: listNotificationsQuerySchema },
  responses: {
    200: { description: "Notifications retrieved" },
  },
});

NotificationsRegistry.registerPath({
  method: "post",
  path: "/notifications/{notificationId}/read",
  tags: ["Notifications"],
  summary: "Mark a single notification as read",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      notificationId: z.string().openapi({ example: "uuid" }),
    }),
  },
  responses: {
    200: { description: "Notification marked as read" },
    404: { description: "Notification not found" },
  },
});

NotificationsRegistry.registerPath({
  method: "post",
  path: "/notifications/read-all",
  tags: ["Notifications"],
  summary: "Mark all of the current user's notifications as read",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "All notifications marked as read" },
  },
});
