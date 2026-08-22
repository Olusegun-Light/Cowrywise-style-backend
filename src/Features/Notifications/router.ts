import type { Router } from "express";
import express from "express";
import NotificationsController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.get("/", asyncHandler(NotificationsController.list));

router.post("/read-all", asyncHandler(NotificationsController.markAllRead));

router.post(
  "/:notificationId/read",
  asyncHandler(NotificationsController.markRead),
);

export default router;
