import { Router } from "express";
import authRouter from "../Features/Auth/router";
import walletRouter from "../Features/Wallet/router";
import webhookRouter from "../Features/Webhook/router";
import savingsRouter from "../Features/Savings/router";
import investmentsRouter from "../Features/Investments/router";

const router = Router();

router.use("/auth", authRouter);
router.use("/wallet", walletRouter);
router.use("/webhook", webhookRouter);
router.use("/savings", savingsRouter);
router.use("/funds", investmentsRouter);

export default router;
