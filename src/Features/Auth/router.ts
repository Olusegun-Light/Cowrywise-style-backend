import type { Router } from "express";
import express from "express";
import AuthController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.post("/signup", asyncHandler(AuthController.signup));

router.post("/verify-email", asyncHandler(AuthController.verifyEmail));

router.post("/login", asyncHandler(AuthController.login));

router.post("/refresh-token", asyncHandler(AuthController.refreshToken));

router.post("/forgot-password", asyncHandler(AuthController.forgotPassword));

router.post(
  "/forgot-password/verify",
  asyncHandler(AuthController.verifyResetOtp),
);

router.post("/reset-password", asyncHandler(AuthController.resetPassword));

router.get("/me", protect, asyncHandler(AuthController.me));

export default router;
