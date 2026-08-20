import type { Router } from "express";
import express from "express";
import AdminController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect, requireAdmin } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get("/kyc/pending", asyncHandler(AdminController.listPendingKyc));

router.post("/kyc/:userId/approve", asyncHandler(AdminController.approveKyc));

router.post("/kyc/:userId/reject", asyncHandler(AdminController.rejectKyc));

router.get("/users", asyncHandler(AdminController.listUsers));

router.post("/users/:userId/freeze", asyncHandler(AdminController.freezeUser));

router.post(
  "/users/:userId/unfreeze",
  asyncHandler(AdminController.unfreezeUser),
);

router.get("/stats", asyncHandler(AdminController.getStats));

export default router;
