import type { Router } from "express";
import express from "express";
import SavingsController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.post("/", asyncHandler(SavingsController.createPlan));

router.get("/", asyncHandler(SavingsController.listPlans));

router.get("/:planId", asyncHandler(SavingsController.getPlan));

router.post("/:planId/fund", asyncHandler(SavingsController.fundPlan));

router.post(
  "/:planId/withdraw",
  asyncHandler(SavingsController.withdrawFromPlan),
);

export default router;
