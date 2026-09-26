import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import authRouter from "../Features/Auth/router";
import walletRouter from "../Features/Wallet/router";
import webhookRouter from "../Features/Webhook/router";
import savingsRouter from "../Features/Savings/router";
import investmentsRouter from "../Features/Investments/router";
import circlesRouter from "../Features/Circles/router";
import kycRouter from "../Features/Kyc/router";
import adminRouter from "../Features/Admin/router";
import statementsRouter from "../Features/Statements/router";
import referralsRouter from "../Features/Referrals/router";
import notificationsRouter from "../Features/Notifications/router";

const router = Router();

// Captures req.baseUrl the instant it reflects this specific mount point —
// unlike reading req.baseUrl later (e.g. in an error handler), this value
// survives Express's error-propagation unwind, since it's a plain property
// we set once, not something Express itself mutates afterward.
const captureBaseUrl = (req: Request, _res: Response, next: NextFunction) => {
  req.metricsBaseUrl = req.baseUrl;
  next();
};

router.use("/auth", captureBaseUrl, authRouter);
router.use("/wallet", captureBaseUrl, walletRouter);
router.use("/webhook", captureBaseUrl, webhookRouter);
router.use("/savings", captureBaseUrl, savingsRouter);
router.use("/funds", captureBaseUrl, investmentsRouter);
router.use("/circles", captureBaseUrl, circlesRouter);
router.use("/kyc", captureBaseUrl, kycRouter);
router.use("/admin", captureBaseUrl, adminRouter);
router.use("/statements", captureBaseUrl, statementsRouter);
router.use("/referrals", captureBaseUrl, referralsRouter);
router.use("/notifications", captureBaseUrl, notificationsRouter);

export default router;
