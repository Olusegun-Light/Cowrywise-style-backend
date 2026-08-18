import type { Router } from "express";
import express from "express";
import CirclesController from "./controller";
import asyncHandler from "../../Middlewares/asyncHandler";
import { protect } from "../../Middlewares/auth";

const router: Router = express.Router();

router.use(protect);

router.post("/", asyncHandler(CirclesController.createCircle));

router.get("/", asyncHandler(CirclesController.listCircles));

router.post("/:circleId/join", asyncHandler(CirclesController.joinCircle));

router.post(
  "/:circleId/contribute",
  asyncHandler(CirclesController.contribute),
);

router.get(
  "/:circleId/contributions",
  asyncHandler(CirclesController.listContributions),
);

router.get("/:circleId", asyncHandler(CirclesController.getCircle));

export default router;
