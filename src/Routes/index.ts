import { Router } from "express";
import authRouter from "../Features/Auth/router";

const router = Router();

router.use("/auth", authRouter);

export default router;
