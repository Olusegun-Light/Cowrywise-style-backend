import type { Router } from "express";
import express from "express";
import InvestmentsController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect, requireAdmin } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.get("/", asyncHandler(InvestmentsController.listFunds));

router.get("/holdings", asyncHandler(InvestmentsController.listHoldings));

router.patch(
  "/:fundId/nav",
  requireAdmin,
  asyncHandler(InvestmentsController.updateNav),
);

router.get("/:fundId/holding", asyncHandler(InvestmentsController.getHolding));

router.get("/:fundId", asyncHandler(InvestmentsController.getFund));

router.post("/:fundId/buy", asyncHandler(InvestmentsController.buyFund));

router.post("/:fundId/redeem", asyncHandler(InvestmentsController.redeemFund));

export default router;
