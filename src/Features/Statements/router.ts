import type { Router } from "express";
import express from "express";
import StatementsController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.get("/wallet", asyncHandler(StatementsController.getWalletStatement));

router.get(
  "/transactions/:transactionId/receipt",
  asyncHandler(StatementsController.getTransactionReceipt),
);

export default router;
