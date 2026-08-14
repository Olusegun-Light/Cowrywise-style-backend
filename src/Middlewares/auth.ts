import type { Request, Response, NextFunction } from "express";
import asyncHandler from "./asyncHandler";
import { AppError } from "../Utils/AppError";
import { verifyToken } from "../Utils/jwt";
import prisma from "../Config/db";

export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("You must be logged in to access this route", 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError("Invalid authorization header", 401);
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError("Invalid token", 401);
    }

    if (payload.purpose !== "access") {
      throw new AppError("Invalid token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (!user.isActive) {
      throw new AppError("This account has been deactivated", 403);
    }

    req.user = { id: user.id, email: user.email };
    next();
  },
);
