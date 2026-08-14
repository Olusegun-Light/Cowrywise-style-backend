import jwt from "jsonwebtoken";
import { env } from "../Config/env";

export type TokenPurpose = "access" | "refresh" | "reset_password";

export interface TokenPayload {
  userId: string;
  email: string;
  purpose: TokenPurpose;
}

type TokenSubject = Omit<TokenPayload, "purpose">;

export const signAccessToken = (payload: TokenSubject) =>
  jwt.sign({ ...payload, purpose: "access" }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });

export const signRefreshToken = (payload: TokenSubject) =>
  jwt.sign({ ...payload, purpose: "refresh" }, env.JWT_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL_SECONDS,
  });

export const signResetPasswordToken = (payload: TokenSubject) =>
  jwt.sign({ ...payload, purpose: "reset_password" }, env.JWT_SECRET, {
    expiresIn: env.RESET_PASSWORD_TOKEN_TTL_SECONDS,
  });

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload;
