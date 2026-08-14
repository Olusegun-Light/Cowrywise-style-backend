import { Router } from "express";
import authRouter from "../Features/Auth/router";
import walletRouter from "../Features/Wallet/router";
import webhookRouter from "../Features/Webhook/router";

const router = Router();

router.use("/auth", authRouter);
router.use("/wallet", walletRouter);
router.use("/webhook", webhookRouter);

export default router;
