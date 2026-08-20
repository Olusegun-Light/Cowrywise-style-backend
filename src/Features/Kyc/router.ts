import type { Router } from "express";
import express from "express";
import KycController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.post("/submit", asyncHandler(KycController.submit));

router.get("/status", asyncHandler(KycController.getStatus));

export default router;
