import type { Router } from "express";
import express from "express";
import InvestmentsController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect, requireAdmin } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.patch(
  "/:fundId/nav",
  requireAdmin,
  asyncHandler(InvestmentsController.updateNav),
);

export default router;
