import type { Router } from "express";
import express from "express";
import WalletController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.post("/fund", asyncHandler(WalletController.fund));

router.get(
  "/fund/verify/:reference",
  asyncHandler(WalletController.verifyFunding),
);

router.post("/withdraw", asyncHandler(WalletController.withdraw));

router.get("/", asyncHandler(WalletController.getWallet));

router.get("/transactions", asyncHandler(WalletController.listTransactions));

export default router;
