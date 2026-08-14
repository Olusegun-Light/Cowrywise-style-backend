import type { Router } from "express";
import express from "express";
import WebhookController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";

const router: Router = express.Router();

router.post("/paystack", asyncHandler(WebhookController.handlePaystackWebhook));

export default router;
