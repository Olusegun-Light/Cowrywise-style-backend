import type { Router } from "express";
import express from "express";
import ReferralsController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.get("/me", asyncHandler(ReferralsController.getMySummary));

export default router;
