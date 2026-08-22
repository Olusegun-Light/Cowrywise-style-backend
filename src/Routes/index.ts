import { Router } from "express";
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

const router = Router();

router.use("/auth", authRouter);
router.use("/wallet", walletRouter);
router.use("/webhook", webhookRouter);
router.use("/savings", savingsRouter);
router.use("/funds", investmentsRouter);
router.use("/circles", circlesRouter);
router.use("/kyc", kycRouter);
router.use("/admin", adminRouter);
router.use("/statements", statementsRouter);
router.use("/referrals", referralsRouter);

export default router;
